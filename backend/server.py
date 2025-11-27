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

# --- MODEL MANAGEMENT -------------------------------------------------------

# Models that should always be available for this backend to function.
REQUIRED_MODELS = [
    "mxbai-embed-large",
    "qwen2.5:0.5b-instruct",
    "qwen2:7b-instruct",
]


def check_and_pull_models() -> None:
    """Ensure all REQUIRED_MODELS are available in the local Ollama instance.

    This is intentionally robust against different response shapes from
    `ollama.list()`. If a model is missing, it will be pulled before the
    server starts handling requests.
    """
    try:
        response = ollama.list()

        # Robust extraction of installed model names
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
            # Check if model (or a tagged variant) is present
            if not any(model in existing for existing in installed):
                logger.info("Model '%s' missing. Pulling now... (this may take time)", model)
                ollama.pull(model)
                logger.info("Model '%s' installed.", model)
            else:
                logger.info("Model '%s' is ready.", model)

    except Exception as e:  # noqa: BLE001
        logger.warning("Could not check/pull models: %s", e)


# Call these immediately when the module is imported so the service is ready.
check_and_pull_models()
init_db()  # Initialize SQLite schema / connections.

app = FastAPI(title="LocalMIND Backend")

# Initialize Orchestrator (drives prompt construction + session compaction)
orchestrator = Orchestrator(profiles)

# Preferred summarizer models in ascending order of size / capability.
PREFERRED_SUMMARIZERS = [
    "qwen2.5:0.5b-instruct",  # Current best small summarizer (~400MB)
    "qwen2.5:0.5b",           # Alternate tag
    "llama3.2:1b",            # Excellent 1B model
    "qwen2:0.5b",             # Older version
    "phi3",                   # Decent fallback, but larger (2.4GB)
]


def get_best_summarizer() -> str:
    """Return the first available model from PREFERRED_SUMMARIZERS.

    This probes the local Ollama registry and picks the smallest viable model
    for background summarization / knowledge graph extraction.
    """
    try:
        response = ollama.list()

        # Normalize to a flat list of model names
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

        # Find the first preferred match (allowing for tagged variants)
        for pref in PREFERRED_SUMMARIZERS:
            for installed in installed_models:
                if installed.startswith(pref):
                    logger.info("Summarizer selected: %s", installed)
                    return installed

        logger.warning("No preferred summarizer found. Defaulting to qwen2.5:0.5b-instruct")
        return "qwen2.5:0.5b-instruct"

    except Exception as e:  # noqa: BLE001
        logger.error("Error selecting summarizer: %s", e)
        return "qwen2.5:0.5b-instruct"


# --- MIDDLEWARE & DATA LAYERS ----------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Local tools only; lock down if exposing externally.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Vector store (Chroma) for long‑term / semantic memories.
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name="local_mind_rag")


# --- Pydantic Schemas -------------------------------------------------------


class ChatRequest(BaseModel):
    """Main chat entry point for legacy mode (no inspector)."""

    message: str
    model: str
    system_prompt: str
    use_memory: bool = True
    summarizer_model: str | None = None


class CreateMemoryRequest(BaseModel):
    """Create a new explicit memory in the vector store."""

    content: str


class UpdateMemoryRequest(BaseModel):
    """Update an existing memory in the vector store by ID."""

    content: str


class BuildPromptRequest(BaseModel):
    """Request payload for the "prompt builder" endpoint.

    This constructs but does *not* execute the final LLM prompt,
    wiring in RAG context, LTM, history, and identity overrides.
    """

    message: str
    model: str
    system_prompt: str
    use_memory: bool = True
    user_name: str | None = None
    user_description: str | None = None


class InferenceRequest(BaseModel):
    """Execute an already‑built prompt.

    `final_prompt` is created by the inspector flow on the frontend.
    """

    final_prompt: str
    model: str
    original_message: str  # Needed for sidecar summary / memory extraction
    summarizer_model: str | None = None


class SnippetRequest(BaseModel):
    """Analyze an arbitrary code/text snippet with explicit instructions.

    This is used for utility operations (summarize, transform, extract, etc.)
    over a selected region of text in the UI.
    """

    snippet: str
    instructions: str
    model: str


class RenderRequest(BaseModel):
    """Render a prompt purely from an already‑built schema."""

    schema_data: dict


class ProjectCreateRequest(BaseModel):
name: str
description: str | None = None


class NodeCreateRequest(BaseModel):
project_id: str
parent_id: str | None = None
name: str
type: str  # 'folder' or 'file'
content: str | None = ""


# --- GLOBAL EXCEPTION HANDLER ----------------------------------------------


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Provide detailed validation feedback for malformed requests.

    This makes it easier to debug contract issues between the UI and backend.
    """
    logger.error("Validation Error: %s", exc.errors())
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )


# --- USER / PROFILE ENDPOINTS ----------------------------------------------


@app.get("/user_profile")
def get_user_profile():
    """Return the active user profile used by the orchestrator.

    For now this is the seeded 'demo_user', but in the future this can
    be driven by authentication / multi-user selection.
    """
    try:
        profile = profiles.get_user_profile("demo_user")
        return profile
    except Exception as e:  # noqa: BLE001
        logger.error("Error fetching user profile: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch user profile") from e


@app.get("/summarizers")
def get_summarizer_status():
    """Report which preferred summarizers are installed and which are missing.

    This is primarily a diagnostics / UX helper for the front-end.
    """
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

    except Exception as e:  # noqa: BLE001
        logger.error("Error getting summarizers: %s", e)
        return {"available": [], "missing": []}


# --- PROMPT CONSTRUCTION & INFERENCE ---------------------------------------


@app.post("/build_prompt")
async def build_prompt_endpoint(request: BuildPromptRequest):
    """Build a fully‑structured prompt using RAG, LTM, history, and identity.

    This does *not* call the main LLM; it only returns the final prompt text
    and metadata so the UI can display / edit before execution.
    """
    try:
        # 1. RAG & Memory Lookup
        rag_context = ""
        memories: list[dict] = []

        if request.use_memory:
            # Fetch RAG context
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

            # Fetch recent LTM memories for the "Long‑Term Memory" block
            mem_results = collection.get(limit=10)
            if mem_results["documents"]:
                for doc in mem_results["documents"]:
                    memories.append({"content": doc})

        # 2. Get History (from SQLite "tape of truth")
        history: list[dict] = []
        conn = get_db_connection()
        rows = conn.execute(
            "SELECT role, content FROM chats "
            "ORDER BY timestamp DESC LIMIT 20"
        ).fetchall()
        conn.close()

        if rows:
            # Reverse to chronological order (oldest → newest)
            for row in reversed(rows):
                history.append({"role": row["role"], "content": row["content"]})

        # 3. Identity overrides, if explicitly provided by the UI
        overrides: dict = {}
        if request.user_name:
            overrides["display_name"] = request.user_name
        if request.user_description:
            overrides["description"] = request.user_description

        # 4. Build schema and render final prompt
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

    except Exception as e:  # noqa: BLE001
        logger.error("Error building prompt: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/infer_with_prompt")
async def infer_with_prompt_endpoint(request: InferenceRequest):
    """Execute a fully‑rendered prompt and run the sidecar summarizer.

    This is the second half of the inspector pipeline:
    1. Save user message to SQLite.
    2. Run main model with the built prompt.
    3. Save assistant response.
    4. Ask a small summarizer to extract durable memory (if any).
    """
    try:
        # 1. Persist user intent to SQLite ("tape of truth")
        conn = get_db_connection()
        conn.execute(
            "INSERT INTO chats (session_id, role, content, model_used) "
            "VALUES (?, ?, ?, ?)",
            ("default_session", "user", request.original_message, request.model),
        )
        conn.commit()

        # 2. Main inference using the constructed prompt
        messages = [{"role": "user", "content": request.final_prompt}]
        response = ollama.chat(model=request.model, messages=messages)
        assistant_response = response["message"]["content"]

        # 3. Persist assistant response
        conn.execute(
            "INSERT INTO chats (session_id, role, content, model_used) "
            "VALUES (?, ?, ?, ?)",
            ("default_session", "assistant", assistant_response, request.model),
        )
        conn.commit()
        conn.close()

        # 4. Sidecar summarizer (curator) to propose new memory
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
                # NOTE: We intentionally do NOT write to Chroma here.
                #       The UI can decide what to persist.

        except Exception as e:  # noqa: BLE001
            logger.error("Sidecar summarizer failed: %s", e)

        return {"response": assistant_response, "new_memory": summary_note}

    except Exception as e:  # noqa: BLE001
        logger.error("Inference failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/analyze_snippet")
async def analyze_snippet_endpoint(request: SnippetRequest):
    """Analyze a snippet of text according to explicit instructions.

    This is a constrained, stateless utility endpoint that does not
    reach into RAG or the SQLite history.
    """
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

    except Exception as e:  # noqa: BLE001
        logger.error("Snippet analysis failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


# --- MEMORY MANAGEMENT (CHROMA) --------------------------------------------


@app.post("/memories")
def create_memory(request: CreateMemoryRequest):
    """Create a new explicit memory entry in t


# --- PROJECT & KNOWLEDGE TREE ENDPOINTS ------------------------------------


@app.get("/projects")
def get_projects():
"""List all available projects/workspaces."""
conn = get_db_connection()
try:
projects = conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
return {"projects": [dict(p) for p in projects]}
finally:
conn.close()


@app.post("/projects")
def create_project(request: ProjectCreateRequest):
"""Create a new isolated workspace/project."""
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
"""Fetch the hierarchical file tree for a specific project."""
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
"""Create a folder or file node within a project."""
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

# If it's a file, we ALSO update Chroma (The "Index")
if request.type == "file" and request.content:
# We tag it with the project_id metadata so we can filter RAG later if desired
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
"""Delete a node (and its index) from the system."""
conn = get_db_connection()
try:
# 1. Delete from SQLite
conn.execute("DELETE FROM knowledge_nodes WHERE id = ?", (node_id,))
conn.commit()

# 2. Delete from Chroma (Safe delete)
try:
collection.delete(ids=[node_id])
except Exception:
pass

return {"status": "deleted"}
finally:
conn.close()



