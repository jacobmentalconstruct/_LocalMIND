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

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation Error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )

chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="local_mind_rag")

class ChatRequest(BaseModel):
    message: str
    model: str
    system_prompt: str

@app.get("/models")
def get_models():
    try:
        # --- DEBUGGING BLOCK ---
        response = ollama.list()
        print(f"\n\n--- RAW OLLAMA RESPONSE ---\n{response}\n---------------------------\n\n")
        
        # Robust Extraction: Handle both object access and dictionary access
        # and handle 'name' vs 'model' keys
        clean_models = []
        
        # Check if response is a dict with 'models' key (common in newer versions)
        if isinstance(response, dict) and 'models' in response:
            model_list = response['models']
        # Check if response is a list directly (older versions)
        elif isinstance(response, list):
            model_list = response
        # Fallback: Maybe it's an object with a models attribute
        else:
            model_list = getattr(response, 'models', [])

        for m in model_list:
            # Try to get name from dict or object
            name = m.get('name') if isinstance(m, dict) else getattr(m, 'name', None)
            # If name is missing, try 'model' key
            if not name:
                name = m.get('model') if isinstance(m, dict) else getattr(m, 'model', None)
            
            if name:
                clean_models.append({'name': name})
        
        return {"models": clean_models}
        # -----------------------
    except Exception as e:
        logger.error(f"Error fetching models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    logger.info(f"Chat Request -> Model: '{request.model}' | Msg: '{request.message[:20]}...'")
    
    try:
        # 1. EMBED
        embedding_response = ollama.embeddings(model='mxbai-embed-large', prompt=request.message)
        query_embedding = embedding_response['embedding']
        
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=5 
        )
        
        context_str = ""
        if results['documents']:
            context_str = "\n".join([doc for doc in results['documents'][0]])
        
        # 2. PROMPT
        full_system_prompt = f"{request.system_prompt}\n\nRELEVANT CONTEXT FROM MEMORY:\n{context_str}"
        
        messages = [
            {'role': 'system', 'content': full_system_prompt},
            {'role': 'user', 'content': request.message}
        ]

        # 3. GENERATE
        logger.info("Sending to Ollama...")
        response = ollama.chat(model=request.model, messages=messages)
        assistant_response = response['message']['content']
        logger.info("Success.")

        # 4. SAVE
        interaction = f"User: {request.message}\nAssistant: {assistant_response}"
        save_embed = ollama.embeddings(model='mxbai-embed-large', prompt=interaction)
        
        collection.add(
            ids=[str(os.urandom(8).hex())],
            embeddings=[save_embed['embedding']],
            documents=[interaction]
        )

        return {"response": assistant_response}
        
    except Exception as e:
        logger.error(f"CRITICAL ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history")
def get_history():
    """Fetch recent chat history from ChromaDB"""
    try:
        # Fetch all documents (limit to last 20 for sanity)
        # Note: Chroma isn't great at time-based retrieval without metadata timestamps.
        # For a true "chat history", a SQL DB is better, but we can hack it here.
        results = collection.get(limit=20)
        
        history = []
        if results['documents']:
            for doc in results['documents']:
                # Our docs are stored as "User: ...\nAssistant: ..."
                # We need to parse this back into structured objects
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