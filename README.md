This `README.md` accurately reflects the architecture, the new "IDE" philosophy, and the specific workflows (like Prompt Staging and Project Management) that we have built.

You can save this directly to `README.md` in your project root.

-----

# LocalMIND: The AI Data Curation IDE

**LocalMIND** is a local-first "Integrated Development Environment" for Knowledge and AI interaction. Unlike standard chatbots that focus on ephemeral conversation, LocalMIND focuses on **Data Curation**, **Prompt Engineering**, and **Knowledge Management**.

It runs entirely on your local machine using **Ollama**, ensuring complete privacy and zero latency costs.

-----

## 🌟 Key Philosophy

LocalMIND shifts the paradigm from **"Chatting"** to **"Refining."**

1.  **The Staging Cockpit:** You don't just "send" messages. You draft a prompt, watch the Orchestrator build the context, preview the model's response in a "Draft" state, edit the text, and *then* commit it to the permanent history.
2.  **Project-Based Memory:** Data isn't just a flat list. It is organized into **Projects**, **Folders**, and **Files** (Nodes).
3.  **Active Curation:** You can save useful model outputs directly into your Project Tree as persistent knowledge assets (RAG).

-----

## 🚀 Features

  * **⚡ Local-First:** Powered by **Ollama**. No API keys, no data leaving your machine.
  * **🗂️ Project Workspace:** A hierarchical file explorer to organize memories, notes, and data snippets into Projects and Folders.
  * **🛠️ Prompt Staging Area:** A split-view inspector that lets you see the raw system prompt and the model's draft response before committing to the database.
  * **🔬 Isolation Mode:** Right-click any file or text selection to run a "Micro-Inference" on just that specific data, ignoring the rest of the conversation context.
  * **🧠 RAG (Retrieval Augmented Generation):** Automatically embeds your project files using `mxbai-embed-large` for semantic search and long-term memory.
  * **💾 Session Management:** Automatically summarizes long conversations into a "Session Context" block to maintain coherence without hitting token limits.

-----

## 🛠️ Tech Stack

  * **Frontend:** React (Vite), TypeScript, Tailwind CSS.
  * **Backend:** Python, FastAPI, Uvicorn.
  * **Database:**
      * **SQLite:** Relational data (Chat logs, Project structure).
      * **ChromaDB:** Vector database (Semantic memory/embeddings).
  * **AI Engine:** Ollama (LLM Inference).

-----

## 📋 Prerequisites

1.  **Ollama**: Must be installed and running.
      * Download from [ollama.com](https://ollama.com).
2.  **Node.js**: v18+.
3.  **Python**: v3.10+.

### Required Models

Run these commands in your terminal to pull the necessary models:

```bash
ollama pull llama3
ollama pull qwen2.5:0.5b-instruct  # For fast summarization
ollama pull mxbai-embed-large      # Critical for RAG/Vector DB
```

-----

## ⚙️ Installation

1.  **Clone the Repository**

    ```bash
    git clone https://github.com/your-username/LocalMIND.git
    cd LocalMIND
    ```

2.  **Backend Setup**

    ```bash
    # Create virtual environment
    python -m venv venv

    # Activate venv (Windows)
    venv\Scripts\activate
    # Activate venv (Linux/Mac)
    # source venv/bin/activate

    # Install dependencies
    pip install -r backend/requirements.txt
    ```

3.  **Frontend Setup**

    ```bash
    npm install
    ```

-----

## ▶️ Running the App

You need two terminal windows running simultaneously.

**Terminal 1: The Backend**

```bash
# Ensure venv is activated
py -m backend.server
# Server will start on http://localhost:8000
```

**Terminal 2: The Frontend**

```bash
npm run dev
# App will launch on http://localhost:3000
```

-----

## 📖 Usage Guide

### 1\. The Workspace (Left Pane)

  * **Projects:** Create a new Project to start a fresh context.
  * **Tree:** Add Folders and Files. These files act as your "Long Term Memory."
  * **Node Inspector:** Click a file to view it. Use the buttons to **Run in Isolation** (query just that file) or **Delete** it.

### 2\. The Staging Workflow (Right Pane)

1.  Type your message in the center chat bar and hit Enter.
2.  **It does NOT send immediately.** It loads into the **Staging Inspector** on the right.
3.  The system will "Auto-Draft" a response (Amber text).
4.  **Review:** If the response is bad, edit your prompt or switch models and click **Re-Run**.
5.  **Commit:** Once satisfied, click **Commit** to save the interaction to the chat history and database.

### 3\. Curation (Saving Knowledge)

  * If the model produces something useful (a code snippet, a summary), click the **"SAVE TO PROJECT"** button in the Inspector.
  * Choose a Project and Folder to save it as a permanent knowledge node.

-----

## ⚠️ Troubleshooting

  * **"Collection expecting embedding with dimension..."**: You likely have an old database created with a different embedding model.
      * **Fix:** Stop the server and run `python resetDBS.py` to wipe the database and start fresh.
  * **"Model not found"**: Ensure you have pulled the models via Ollama (`ollama pull ...`) and that they match the names in `backend/server.py`.

-----

## 📜 License

MIT License. Built for the Local AI Community.