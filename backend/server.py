import os
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import chromadb
import ollama

# Orchestration Modules
import backend.profiles as profiles
from backend.orchestrator import Orchestrator
from backend.database import init_db, get_db_connection

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- MODEL MANAGEMENT -------------------------------------------------------

REQUIRED_MODELS = [
    "mxbai-embed-large",
    "qwen2.5:0.5b-instruct",
    "qwen2:7b-instruct",
]


def check_and_pull_models() -> None:
    """Ensure all REQUIRED_MODELS are available in the local Ollama instance."""
    try:
        response = ollama.list()
        model_list = []
        if isinstance(response, dict) and "models" in response:
            model_list = response["models"]
        elif isinstance(response, list):
            model_list = response
        else:
            model_list = getattr(response, "models", [])

        installed: list[str] = []
        for m in model_list:
            name = m.get("name") if isinstance(m, dict) else getattr(m, "name", None)
            if not name:
                name = m.get("model") if isinstance(m, dict) else getattr(m, "model", None)
            if name:
                installed.append(name)

        for model in REQUIRED_MODELS:
            if not any(model in existing for existing in installed):
                logger.info("Model '%s' missing. Pulling now...", model)
                ollama.pull(model)
                logger.info("Model '%s' installed.", model)
            else:
                logger.info("Model '%s' is ready.", model)

    except Exception as e:
        logger.warning("Could not check/pull models: %s", e)


check_and_pull_models()
init_db()

app = FastAPI(title="LocalMIND Backend")

orchestrator = Orchestrator(profiles)

PREFERRED_SUMMARIZERS = [
    "qwen2.5:0.5b-instruct",
    "qwen2.5:0.5b",
    "llama3.2:1b",
    "qwen2:0.5b",
    "phi3",
]


def get_best_summarizer() -> str:
    try:
        response = ollama.list()
        installed_models: list[str] = []
        if isinstance(response, dict) and "models" in response:
            installed_models = [m["name"] for m in response["models"]]
        elif isinstance(response, list):
            installed_models = [m["name"] for m in response]
        else:
            raw_list = getattr(response, "models", [])
            for m in raw_list:
                name = m.get("name") if isinstance(m, dict) else getattr(m, "name", None)
                if name:
                    installed_models.append(name)

        for pref in PREFERRED_SUMMARIZERS:
            for installed in installed_models:
                if installed.startswith(pref):
                    logger.info("Summarizer selected: %s", installed)
                    return installed

        logger.warning("No preferred summarizer found. Defaulting to qwen2.5:0.5b-instruct")
        return "qwen2.5:0.5b-instruct"

    except Exception as e:
        logger.error("Error selecting summarizer: %s", e)
        return "qwen2.5:0.5b-instruct"


# --- MIDDLEWARE & DATA LAYERS ----------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="local_mind_rag")


# --- Pydantic Schemas -------------------------------------------------------

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
    user_name: str | None = None
    user_description: str | None = None


class InferenceRequest(BaseModel):
    final_prompt: str
    model: str
    original_message: str
    summarizer_model: str | None = None
    store: bool = True


class SnippetRequest(BaseModel):
    snippet: str
    instructions: str
    model: str


class RenderRequest(BaseModel):
    schema_data: dict


class ProjectCreateRequest(BaseModel):
    name: str
    description: str | None = None


class NodeCreateRequest(BaseModel):
    project_id: str
    parent_id: str | None = None
    name: str
    type: str
    content: str | None = ""


# --- GLOBAL EXCEPTION HANDLER ----------------------------------------------

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error("Validation Error: %s", exc.errors())
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )


# --- USER / PROFILE ENDPOINTS ----------------------------------------------

@app.get("/user_profile")
def get_user_profile():
    try:
        profile = profiles.get_user_profile("demo_user")
        return profile
    except Exception as e:
        logger.error("Error fetching user profile: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch user profile") from e


@app.get("/summarizers")
def get_summarizer_status():
    try:
        response = ollama.list()
        raw_list = []

        if isinstance(response, dict) and "models" in response:
            raw_list = response["models"]
        elif isinstance(response, list):
            raw_list = response
        else:
            raw_list = getattr(response, "models", [])

        installed_list: list[str] = []
        for m in raw_list:
            name = m.get("name") if isinstance(m, dict) else getattr(m, "name", None)
            if not name:
                name = m.get("model") if isinstance(m, dict) else getattr(m, "model", None)
            if name:
                installed_list.append(name)

        available: list[str] = []
        missing: list[str] = []

        for pref in PREFERRED_SUMMARIZERS:
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
        logger.error("Error getting summarizers: %s", e)
        return {"available": [], "missing": []}


# --- PROMPT CONSTRUCTION & INFERENCE ---------------------------------------

@app.post("/build_prompt")
async def build_prompt_endpoint(request: BuildPromptRequest):
    try:
        # 1. RAG & Memory Lookup
        rag_context = ""
        memories: list[dict] = []

        if request.use_memory:
            embedding_response = ollama.embeddings(
                model="mxbai-embed-large",
                prompt=request.message,
            )
            results = collection.query(
                query_embeddings=[embedding_response["embedding"]],
                n_results=5,
            )
            if results["documents"]:
                rag_context = "\n".join(results["documents"][0])[:12000]

            mem_results = collection.get(limit=10)
            if mem_results["documents"]:
                for doc in mem_results["documents"]:
                    memories.append({"content": doc})

        # 2. Get History
        history: list[dict] = []
        conn = get_db_connection()
        rows = conn.execute(
            "SELECT role, content FROM chats ORDER BY timestamp DESC LIMIT 20"
        ).fetchall()
        conn.close()

        if rows:
            for row in reversed(rows):
                history.append({"role": row["role"], "content": row["content"]})

        # 3. Identity overrides
        overrides: dict = {}
        if request.user_name:
            overrides["display_name"] = request.user_name
        if request.user_description:
            overrides["description"] = request.user_description

        # 4. Build schema
        schema = orchestrator.build_context_schema(
            user_message=request.message,
            model_name=request.model,
            system_prompt_override=request.system_prompt,
            memories=memories,
            rag_context=rag_context,
            history=history,
            identity_overrides=overrides,
        )

        final_prompt = orchestrator.render_final_prompt(schema)

        return {
            "final_prompt": final_prompt,
            "meta": schema["meta"],
        }

    except Exception as e:
        logger.error("Error building prompt: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/infer_with_prompt")
async def infer_with_prompt_endpoint(request: InferenceRequest):
    try:
        # 1. Persist user intent
        if request.store:
            conn = get_db_connection()
            conn.execute(
                "INSERT INTO chats (session_id, role, content, model_used) VALUES (?, ?, ?, ?)",
                ("default_session", "user", request.original_message, request.model),
            )
            conn.commit()
            conn.close()

        # 2. Main inference
        messages = [{"role": "user", "content": request.final_prompt}]
        response = ollama.chat(model=request.model, messages=messages)
        assistant_response = response["message"]["content"]

        # 3. Persist assistant response
        if request.store:
            conn = get_db_connection()
            conn.execute(
                "INSERT INTO chats (session_id, role, content, model_used) VALUES (?, ?, ?, ?)",
                ("default_session", "assistant", assistant_response, request.model),
            )
            conn.commit()
            conn.close()

        # 4. Sidecar summarizer
        summary_note: dict | None = None
        try:
            summarizer_model = request.summarizer_model or get_best_summarizer()
            summary_prompt = f"""
Analyze this interaction and extract only the useful, durable facts or context to remember.
Ignore pleasantries. If nothing is worth remembering, reply with "NO_DATA".

User: {request.original_message}
AI: {assistant_response}

Summary:
""".strip()

            summary_res = ollama.chat(
                model=summarizer_model,
                messages=[{"role": "user", "content": summary_prompt}],
            )
            summary_text = summary_res["message"]["content"].strip()

            if summary_text and "NO_DATA" not in summary_text:
                import uuid
                temp_id = "temp_" + str(uuid.uuid4())[:8]
                summary_note = {"id": temp_id, "content": summary_text}

        except Exception as e:
            logger.error("Sidecar summarizer failed: %s", e)

        return {"response": assistant_response, "new_memory": summary_note}

    except Exception as e:
        logger.error("Inference failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e

@app.post("/analyze_snippet")
async def analyze_snippet_endpoint(request: SnippetRequest):
    try:
        prompt = f"""SYSTEM: You are a utility assistant. Only use the snippet provided.

SNIPPET:
{request.snippet}

INSTRUCTIONS:
{request.instructions}

RESPONSE:"""

        response = ollama.chat(
            model=request.model,
            messages=[{"role": "user", "content": prompt}],
        )
        return {"result": response["message"]["content"]}

    except Exception as e:
        logger.error("Snippet analysis failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


# --- SESSION & UTILITY ENDPOINTS -------------------------------------------

@app.get("/session_summary")
def get_session_summary_endpoint():
    try:
        summary = orchestrator.session_manager.get_session_summary()
        return {"summary": summary}
    except Exception as e:
        logger.error(f"Error fetching summary: {e}")
        return {"summary": ""}

@app.get("/history")
def get_chat_history():
    conn = get_db_connection()
    try:
        rows = conn.execute("SELECT role, content FROM chats ORDER BY id DESC LIMIT 50").fetchall()
        return {"history": [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]}
    finally:
        conn.close()

@app.post("/reset/sqlite")
def reset_sqlite():
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM chats")
        conn.execute("DELETE FROM session_summaries")
        conn.commit()
        return {"status": "cleared"}
    finally:
        conn.close()

@app.post("/reset/chroma")
def reset_chroma():
    try:
        ids = collection.get()['ids']
        if ids:
            collection.delete(ids=ids)
        return {"status": "cleared"}
    except Exception as e:
        logger.error(f"Chroma reset failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models")
def list_models():
    try:
        response = ollama.list()
        if isinstance(response, dict) and "models" in response:
            return {"models": response["models"]}
        elif isinstance(response, list):
             return {"models": response}
        return {"models": getattr(response, "models", [])}
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        return {"models": []}

# --- MEMORY MANAGEMENT (CHROMA) --------------------------------------------

@app.get("/memories")
def get_memories():
    try:
        results = collection.get(where={"type": "manual_memory"})
        memories = []
        if results["ids"]:
            for i, mid in enumerate(results["ids"]):
                memories.append({"id": mid, "content": results["documents"][i]})
        return {"memories": memories}
    except Exception as e:
        logger.error(f"Error fetching memories: {e}")
        return {"memories": []}


@app.post("/memories")
def create_memory(request: CreateMemoryRequest):
    try:
        import uuid
        mem_id = str(uuid.uuid4())
        collection.add(
            documents=[request.content],
            metadatas=[{"type": "manual_memory"}],
            ids=[mem_id]
        )
        return {"id": mem_id, "content": request.content}
    except Exception as e:
        logger.error(f"Error creating memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/memories/{memory_id}")
def update_memory(memory_id: str, request: UpdateMemoryRequest):
    try:
        collection.update(
            ids=[memory_id],
            documents=[request.content]
        )
        return {"status": "updated", "id": memory_id}
    except Exception as e:
        logger.error(f"Error updating memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- PROJECT & KNOWLEDGE TREE ENDPOINTS ------------------------------------

@app.get("/projects")
def get_projects():
    conn = get_db_connection()
    try:
        projects = conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
        return {"projects": [dict(p) for p in projects]}
    finally:
        conn.close()


@app.post("/projects")
def create_project(request: ProjectCreateRequest):
    import uuid
    project_id = str(uuid.uuid4())
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO projects (id, name, description) VALUES (?, ?, ?)",
            (project_id, request.name, request.description),
        )
        conn.commit()
        return {"id": project_id, "name": request.name}
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.get("/tree")
def get_knowledge_tree(project_id: str):
    conn = get_db_connection()
    try:
        nodes = conn.execute(
            "SELECT * FROM knowledge_nodes WHERE project_id = ? ORDER BY type DESC, name ASC",
            (project_id,),
        ).fetchall()
        return {"nodes": [dict(n) for n in nodes]}
    finally:
        conn.close()


@app.post("/tree/nodes")
def create_node(request: NodeCreateRequest):
    import uuid
    node_id = str(uuid.uuid4())
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO knowledge_nodes (id, project_id, parent_id, name, type, content) VALUES (?, ?, ?, ?, ?, ?)",
            (
                node_id,
                request.project_id,
                request.parent_id,
                request.name,
                request.type,
                request.content,
            ),
        )
        conn.commit()

        if request.type == "file" and request.content:
            collection.add(
                documents=[request.content],
                metadatas=[
                    {"node_id": node_id, "project_id": request.project_id, "name": request.name}
                ],
                ids=[node_id],
            )

        return {"id": node_id, "status": "created"}
    except Exception as e:
        logger.error(f"Error creating node: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.delete("/tree/nodes/{node_id}")
def delete_node(node_id: str):
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM knowledge_nodes WHERE id = ?", (node_id,))
        conn.commit()
        try:
            collection.delete(ids=[node_id])
        except Exception:
            pass
        return {"status": "deleted"}
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting LocalMIND Backend on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)



