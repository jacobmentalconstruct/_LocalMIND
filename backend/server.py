import os
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import chromadb
import ollama

# [NEW] Orchestration Modules
import backend.profiles as profiles
from backend.orchestrator import Orchestrator
from backend.database import init_db, get_db_connection

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
        
        if isinstance(response, dict) and 'models' in response:
            model_list = response['models']
        elif isinstance(response, list):
            model_list = response
        else:
            model_list = getattr(response, 'models', [])
        
        installed = []
        for m in model_list:
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
init_db() # Initialize SQLite

app = FastAPI()

# Initialize Orchestrator
orchestrator = Orchestrator(profiles)

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

class CreateMemoryRequest(BaseModel):
    content: str

class UpdateMemoryRequest(BaseModel):
    content: str

class BuildPromptRequest(BaseModel):
    message: str
    model: str
    system_prompt: str
    use_memory: bool = True

class InferenceRequest(BaseModel):
    final_prompt: str
    model: str
    original_message: str # Needed for sidecar summary
    summarizer_model: str | None = None

class SnippetRequest(BaseModel):
    snippet: str
    instructions: str
    model: str

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

@app.post("/build_prompt")
async def build_prompt_endpoint(request: BuildPromptRequest):
    try:
        # 1. RAG & Memory Lookup
        rag_context = ""
        memories = []
        
        if request.use_memory:
            # Fetch RAG
            embedding_response = ollama.embeddings(model='mxbai-embed-large', prompt=request.message)
            results = collection.query(query_embeddings=[embedding_response['embedding']], n_results=5)
            if results['documents']:
                rag_context = "\n".join([doc for doc in results['documents'][0]])[:12000]
            
            # Fetch All Memories (for the LTM block)
            mem_results = collection.get(limit=10)
            if mem_results['documents']:
                for doc in mem_results['documents']:
                    memories.append({"content": doc})

        # 2. Get History (FROM SQLITE NOW)
        history = []
        conn = get_db_connection()
        # Fetch last 20 messages, newest first, then reverse
        rows = conn.execute("SELECT role, content FROM chats ORDER BY timestamp DESC LIMIT 20").fetchall()
        conn.close()
        
        if rows:
             # Reverse to get chronological order (Oldest -> Newest)
            for row in reversed(rows):
                history.append({'role': row['role'], 'content': row['content']})

        # 3. Build Schema
        schema = orchestrator.build_context_schema(
            user_message=request.message,
            model_name=request.model,
            system_prompt_override=request.system_prompt,
            memories=memories,
            rag_context=rag_context,
            history=history
        )

        # 4. Render
        final_prompt = orchestrator.render_final_prompt(schema)
        
        return {
            "final_prompt": final_prompt,
            "meta": schema["meta"]
        }
    except Exception as e:
        logger.error(f"Error building prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/infer_with_prompt")
async def infer_with_prompt_endpoint(request: InferenceRequest):
    try:
        # [NEW] Save User's intent to "Tape of Truth" (Even if via Inspector)
        conn = get_db_connection()
        conn.execute(
            "INSERT INTO chats (session_id, role, content, model_used) VALUES (?, ?, ?, ?)",
            ("default_session", "user", request.original_message, request.model)
        )
        conn.commit()

        # 1. Raw Inference using the constructed prompt
        messages = [{'role': 'user', 'content': request.final_prompt}]
        
        response = ollama.chat(model=request.model, messages=messages)
        assistant_response = response['message']['content']

        # [NEW] Save Assistant's response to "Tape of Truth"
        conn.execute(
            "INSERT INTO chats (session_id, role, content, model_used) VALUES (?, ?, ?, ?)",
            ("default_session", "assistant", assistant_response, request.model)
        )
        conn.commit()
        conn.close()

        # 2. Trigger Sidecar (The Curator)
        summary_note = None
        try:
            summarizer_model = request.summarizer_model or get_best_summarizer()
            summary_prompt = f"""
            Analyze this interaction and extract only the useful facts or context to remember.
            Ignore pleasantries. If nothing is worth remembering, reply with "NO_DATA".
            
            User: {request.original_message}
            AI: {assistant_response}
            
            Summary:
            """
            summary_res = ollama.chat(model=summarizer_model, messages=[{'role': 'user', 'content': summary_prompt}])
            summary_text = summary_res['message']['content'].strip()
            
            if summary_text and "NO_DATA" not in summary_text:
                # [CHANGED] We NO LONGER save to Chroma automatically.
                # We just create a temporary object to send to the UI.
                import uuid
                temp_id = "temp_" + str(uuid.uuid4())[:8]
                summary_note = {'id': temp_id, 'content': summary_text} 
                # Note: collection.add is GONE.
        except Exception as e:
            logger.error(f"Sidecar failed: {e}")

        return {"response": assistant_response, "new_memory": summary_note}
    except Exception as e:
        logger.error(f"Inference failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze_snippet")
async def analyze_snippet_endpoint(request: SnippetRequest):
    try:
        prompt = f"""SYSTEM: You are a utility assistant. Only use the snippet provided.

SNIPPET:
{request.snippet}

INSTRUCTIONS:
{request.instructions}

RESPONSE:"""
        
        response = ollama.chat(model=request.model, messages=[{'role': 'user', 'content': prompt}])
        return {"result": response['message']['content']}
    except Exception as e:
        logger.error(f"Snippet analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/memories")
def create_memory(request: CreateMemoryRequest):
    try:
        # 1. Embed
        embedding_response = ollama.embeddings(model='mxbai-embed-large', prompt=request.content)
        
        # 2. Save to Chroma
        new_id = str(os.urandom(8).hex())
        collection.add(
            ids=[new_id], 
            embeddings=[embedding_response['embedding']], 
            documents=[request.content]
        )
        return {"id": new_id, "content": request.content, "status": "success"}
    except Exception as e:
        logger.error(f"Error creating memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
        conn = get_db_connection()
        
        # [NEW] 1. SAVE USER MSG TO SQLITE (The Rising Edge Input)
        conn.execute(
            "INSERT INTO chats (session_id, role, content, model_used) VALUES (?, ?, ?, ?)",
            ("default_session", "user", request.message, request.model)
        )
        conn.commit()

        # 2. RETRIEVE CONTEXT (RAG)
        context_str = ""
        if request.use_memory:
            embedding_response = ollama.embeddings(model='mxbai-embed-large', prompt=request.message)
            query_embedding = embedding_response['embedding']
            
            results = collection.query( 
                query_embeddings=[query_embedding],
                n_results=5
            )
            
            if results['documents']:
                raw_context = "\n".join([doc for doc in results['documents'][0]])
                context_str = raw_context[:12000]
        
        # 3. PREPARE PROMPT FOR MAIN MODEL
        full_system_prompt = f"{request.system_prompt}\n\nRELEVANT MEMORIES:\n{context_str}"
        
        messages = [
            {'role': 'system', 'content': full_system_prompt},
            {'role': 'user', 'content': request.message}
        ]

        # 4. MAIN MODEL GENERATION
        response = ollama.chat(model=request.model, messages=messages)
        assistant_response = response['message']['content']

        # [NEW] 5. SAVE ASSISTANT MSG TO SQLITE (The Rising Edge Output)
        conn.execute(
            "INSERT INTO chats (session_id, role, content, model_used) VALUES (?, ?, ?, ?)",
            ("default_session", "assistant", assistant_response, request.model)
        )
        conn.commit()
        conn.close()

        # 6. SYNCHRONOUS "SIDECAR" SUMMARY
        summary_note = None
        try:
            summarizer_model = request.summarizer_model or get_best_summarizer()
            summary_prompt = f"""
            You are a Knowledge Graph extraction tool.
            Analyze the following interaction.
            
            Extract ONLY permanent facts about the user, the project, or the world.
            - DO NOT summarize the conversation flow (e.g. "User asked for help").
            - DO NOT record transient debugging steps.
            - ONLY record facts like "User is building a React app" or "Project uses SQLite".
            
            If there are no new PERMANENT facts, reply exactly with "NO_DATA".
            
            User: {request.original_message if hasattr(request, 'original_message') else request.message}
            AI: {assistant_response}
            
            Fact:
            """
            
            summary_res = ollama.chat(model=summarizer_model, messages=[{'role': 'user', 'content': summary_prompt}])
            summary_text = summary_res['message']['content'].strip()

            if summary_text and "NO_DATA" not in summary_text:
                # [CHANGED] We NO LONGER save to Chroma automatically.
                # We just create a temporary object to send to the UI.
                import uuid
                temp_id = "temp_" + str(uuid.uuid4())[:8]
                summary_note = {'id': temp_id, 'content': summary_text} 
                # Note: collection.add is GONE.
                
        except Exception as e:
            logger.error(f"Summary failed: {e}")

        # 7. TRIGGER SESSION COMPACTOR (Fire and Forget)
        try: 
            # [FIX] Correct indentation here
            orchestrator.session_manager.check_and_compact(
                session_id="default_session",
                model_name=request.summarizer_model or "qwen2.5:0.5b-instruct"
            ) 
        except Exception as e:
            logger.error(f"Compaction trigger failed: {e}")
        
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
    """Fetch recent chat history from SQLite (Tape of Truth)"""
    try:
        conn = get_db_connection()
        # Fetch last 20 messages, ordered by newest first
        rows = conn.execute("SELECT role, content FROM chats ORDER BY timestamp DESC LIMIT 20").fetchall()
        conn.close()
        
        history = []
        # Reverse them to return in chronological order (Oldest -> Newest)
        for row in reversed(rows):
            history.append({'role': row['role'], 'content': row['content']})
        
        return {"history": history}
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        return {"history": []}

# Add this to backend/server.py
@app.get("/session_summary")
def get_session_summary_endpoint():
    try:
        # We need to instantiate the manager
        from backend.session_manager import SessionManager
        mgr = SessionManager()
        summary = mgr.get_session_summary("default_session")
        return {"summary": summary}
    except Exception as e:
        logger.error(f"Error fetching session summary: {e}")
        return {"summary": ""}

# Endpoint to fetch raw ingredients
@app.post("/get_prompt_context")
async def get_prompt_context_endpoint(request: BuildPromptRequest):
    try:
        # 1. RAG & Memory
        rag_context = ""
        memories = []
        if request.use_memory:
            embedding_response = ollama.embeddings(model='mxbai-embed-large', prompt=request.message)
            results = collection.query(query_embeddings=[embedding_response['embedding']], n_results=5)
            if results['documents']:
                rag_context = "\n".join([doc for doc in results['documents'][0]])[:12000]
            
            # Fetch LTM
            mem_results = collection.get(limit=10)
            if mem_results['documents']:
                for doc in mem_results['documents']:
                    memories.append({"content": doc})

        # 2. History (From SQLite)
        history = []
        conn = get_db_connection()
        rows = conn.execute("SELECT role, content FROM chats ORDER BY timestamp DESC LIMIT 20").fetchall()
        conn.close()
        if rows:
            for row in reversed(rows):
                history.append({'role': row['role'], 'content': row['content']})

        return {
            "rag_context": rag_context,
            "memories": memories,
            "history": history
        }
    except Exception as e:
        logger.error(f"Error fetching context: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint to Render only
class RenderRequest(BaseModel):
    schema_data: dict # Pass the full schema to render

@app.post("/render_prompt")
async def render_prompt_endpoint(request: RenderRequest):
    try:
        # We use the orchestrator to render the final string from the schema
        final_prompt = orchestrator.render_final_prompt(request.schema_data)
        return {"final_prompt": final_prompt}
    except Exception as e:
        logger.error(f"Error rendering prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)