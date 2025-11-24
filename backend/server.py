import os
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import chromadb
import ollama

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- AUTO-PULL MODELS ---
REQUIRED_MODELS = [
    "mxbai-embed-large",
    "qwen2.5:0.5b-instruct",
    "qwen2:7b-instruct" 
]

def check_and_pull_models():
    """Loops through required models and pulls them if missing."""
    try:
        # Robust extraction of installed model names
        response = ollama.list()
        model_list = []
        
        # [FIX] Corrected Indentation Block
        if isinstance(response, dict) and 'models' in response:
            model_list = response['models']
        elif isinstance(response, list):
            model_list = response
        else:
            model_list = getattr(response, 'models', [])
        
        installed = []
        for m in model_list:
            # Try 'name' then 'model', handling both dicts and objects
            name = m.get('name') if isinstance(m, dict) else getattr(m, 'name', None)
            if not name:
                name = m.get('model') if isinstance(m, dict) else getattr(m, 'model', None)
            if name:
                installed.append(name)

        for model in REQUIRED_MODELS:
            # Check if model (or :latest) is present
            if not any(model in i for i in installed):
                logger.info(f"Model '{model}' missing. Pulling now... (this may take time)")
                ollama.pull(model)
                logger.info(f"Model '{model}' installed.")
            else:
                logger.info(f"Model '{model}' is ready.")
                
    except Exception as e:
        logger.warning(f"Could not check/pull models: {e}")

# Call this immediately when script loads
check_and_pull_models()

app = FastAPI()

# DEFINE YOUR TRUSTED SUMMARIZERS HERE (Smallest to Largest)
PREFERRED_SUMMARIZERS = [
    "qwen2.5:0.5b-instruct",  # Your current best option (~400MB)
    "qwen2.5:0.5b",           # Alternate tag
    "llama3.2:1b",            # Excellent 1B model
    "qwen2:0.5b",             # Older version
    "phi3",                   # Decent fallback, but larger (2.4GB)
]

def get_best_summarizer():
    """Finds the first available model from the preferred list."""
    try:
        # Get list of installed models
        response = ollama.list()
        
        # Normalize the list to just model names
        installed_models = []
        if isinstance(response, dict) and 'models' in response:
            installed_models = [m['name'] for m in response['models']]
        elif isinstance(response, list):
            installed_models = [m['name'] for m in response]
        else:
            # Fallback for object-based responses
            temp_list = getattr(response, 'models', [])
            installed_models = []
            for m in temp_list:
                name = m.get('name') if isinstance(m, dict) else getattr(m, 'name', None)
                if name: installed_models.append(name)
        
        # Find the first match
        for pref in PREFERRED_SUMMARIZERS:
            # Check for exact match or match ignoring ':latest'
            for installed in installed_models:
                if installed.startswith(pref): 
                    logger.info(f"Summarizer selected: {installed}")
                    return installed
                    
        # Fallback if nothing found (will likely trigger a pull error, which is fine)
        logger.warning("No preferred summarizer found. Defaulting to qwen2.5:0.5b-instruct")
        return "qwen2.5:0.5b-instruct"
        
    except Exception as e:
        logger.error(f"Error selecting summarizer: {e}")
        return "qwen2.5:0.5b-instruct"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- INIT DATABASE ---
# We initialize this early so endpoints can use it
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="local_mind_rag")

class ChatRequest(BaseModel):
    message: str
    model: str
    system_prompt: str
    use_memory: bool = True
    summarizer_model: str | None = None

class UpdateMemoryRequest(BaseModel):
    content: str

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation Error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )

# --- ENDPOINTS ---

@app.get("/summarizers")
def get_summarizer_status():
    try:
        # Get all installed models
        response = ollama.list()
        installed_list = []
        
        # Robust extraction (same as check_and_pull_models)
        raw_list = []
        if isinstance(response, dict) and 'models' in response:
            raw_list = response['models']
        elif isinstance(response, list):
            raw_list = response
        else:
            raw_list = getattr(response, 'models', [])

        for m in raw_list:
            name = m.get('name') if isinstance(m, dict) else getattr(m, 'name', None)
            if not name:
                name = m.get('model') if isinstance(m, dict) else getattr(m, 'model', None)
            if name:
                installed_list.append(name)
        
        available = []
        missing = []
        
        for pref in PREFERRED_SUMMARIZERS:
            # Check exact or fuzzy match
            found = False
            for inst in installed_list:
                if inst.startswith(pref):
                    available.append(inst)
                    found = True
                    break
            if not found:
                missing.append(pref)
                
        return {"available": available, "missing": missing}
    except Exception as e:
        logger.error(f"Error getting summarizers: {e}")
        return {"available": [], "missing": []}

@app.put("/memories/{memory_id}")
def update_memory(memory_id: str, request: UpdateMemoryRequest):
    try:
        # 1. Re-Embed the new content
        embedding_response = ollama.embeddings(model='mxbai-embed-large', prompt=request.content)
        new_embedding = embedding_response['embedding']

        # 2. Update in Chroma
        collection.update(
            ids=[memory_id],
            embeddings=[new_embedding],
            documents=[request.content]
        )
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error updating memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/memories")
def get_memories():
    try:
        results = collection.get()
        memories = []
        if results['documents']:
            for i, doc in enumerate(results['documents']):
                memories.append({
                    'id': results['ids'][i],
                    'content': doc
                })
        return {"memories": memories}
    except Exception as e:
        logger.error(f"Error fetching memories: {e}")
        return {"memories": []}

@app.post("/chat")
async def chat_endpoint(request: ChatRequest): 
    logger.info(f"Chat Request -> Model: '{request.model}'")
    
    try:
        # 1. RETRIEVE CONTEXT (RAG)
        context_str = ""
        if request.use_memory:
            embedding_response = ollama.embeddings(model='mxbai-embed-large', prompt=request.message)
            query_embedding = embedding_response['embedding']
            
            results = collection.query( 
                query_embeddings=[query_embedding],
                n_results=5
            )
            
            if results['documents']:
                # The context is a list of past summaries
                raw_context = "\n".join([doc for doc in results['documents'][0]])
                # [FIX] Truncate to ~3000 tokens (approx 12k chars) to prevent crash
                context_str = raw_context[:12000]
        
        # 2. PREPARE PROMPT FOR MAIN MODEL
        full_system_prompt = f"{request.system_prompt}\n\nRELEVANT MEMORIES:\n{context_str}"
        
        messages = [
            {'role': 'system', 'content': full_system_prompt},
            {'role': 'user', 'content': request.message}
        ]

        # 3. MAIN MODEL GENERATION
        response = ollama.chat(model=request.model, messages=messages)
        assistant_response = response['message']['content']

        # 4. SYNCHRONOUS "SIDECAR" SUMMARY
        summary_note = None
        try:
            # DYNAMICALLY GET THE MODEL NAME
            # Use client choice if provided, otherwise auto-select
            summarizer_model = request.summarizer_model or get_best_summarizer()
            
            summary_prompt = f"""
            Analyze this interaction and extract only the useful facts or context to remember.
            Ignore pleasantries. If nothing is worth remembering, reply with "NO_DATA".
            
            User: {request.message}
            AI: {assistant_response}
            
            Summary:
            """
            
            # Fast inference with tiny model
            summary_res = ollama.chat(model=summarizer_model, messages=[{'role': 'user', 'content': summary_prompt}])
            summary_text = summary_res['message']['content'].strip()

            if summary_text and "NO_DATA" not in summary_text:
                # Save to RAG
                save_embed = ollama.embeddings(model='mxbai-embed-large', prompt=summary_text)
                new_id = str(os.urandom(8).hex())
                collection.add(ids=[new_id], embeddings=[save_embed['embedding']], documents=[summary_text])
                
                # Prepare to send back to UI
                summary_note = {'id': new_id, 'content': summary_text}
                
        except Exception as e:
            logger.error(f"Summary failed: {e}")

        # Return BOTH the reply and the new note
        return {
            "response": assistant_response, 
            "new_memory": summary_note 
        }

    except Exception as e:
        logger.error(f"CRITICAL ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models")
def get_models():
    try:
        response = ollama.list()
        clean_models = []
        
        if isinstance(response, dict) and 'models' in response:
            model_list = response['models']
        elif isinstance(response, list):
            model_list = response
        else:
            model_list = getattr(response, 'models', [])

        for m in model_list:
            name = m.get('name') if isinstance(m, dict) else getattr(m, 'name', None)
            if not name:
                name = m.get('model') if isinstance(m, dict) else getattr(m, 'model', None)
            
            if name:
                clean_models.append({'name': name})
        
        return {"models": clean_models}
    except Exception as e:
        logger.error(f"Error fetching models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history")
def get_history():
    """Fetch recent chat history from ChromaDB"""
    try:
        results = collection.get(limit=20)
        history = []
        if results['documents']:
            for doc in results['documents']:
                # Note: This parser might need adjustment if we stop saving "User: ... Assistant: ..." format
                # But for legacy data it will work.
                parts = doc.split("\nAssistant: ")
                if len(parts) == 2:
                    user_msg = parts[0].replace("User: ", "")
                    ai_msg = parts[1]
                    history.append({'role': 'user', 'content': user_msg})
                    history.append({'role': 'assistant', 'content': ai_msg})
        
        return {"history": history}
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        return {"history": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)