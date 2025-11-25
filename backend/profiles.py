import json
import sqlite3
from backend.database import get_db_connection

def get_user_profile(user_id="demo_user"):
    """
    Fetch user profile from SQLite.
    """
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE user_id = ?', (user_id,)).fetchone()
    conn.close()

    if user:
        return {
            "user_id": user["user_id"],
            "display_name": user["display_name"],
            "workspace": user["workspace"],
            "preferences": json.loads(user["preferences"]) if user["preferences"] else {}
        }
    else:
        # Fallback / Error handling
        return {
            "user_id": "guest",
            "display_name": "Guest",
            "workspace": "Guest Workspace",
            "preferences": {}
        }

def get_model_profile(model_name):
    """
    Fetch model profile from SQLite or generate default.
    """
    # Check DB first
    conn = get_db_connection()
    db_model = conn.execute('SELECT * FROM model_configs WHERE model_id = ?', (model_name,)).fetchone()
    conn.close()

    if db_model:
        return {
            "model_id": db_model["model_id"],
            "display_name": db_model["display_name"],
            "context_limit": db_model["context_limit"],
            "base_system_prompt": db_model["base_system_prompt"],
            "prompt_template": "standard_chat" # Hardcoded for now
        }

    # Default Fallback Logic (same as before)
    profile = {
        "model_id": model_name,
        "display_name": model_name,
        "context_limit": 4096,
        "prompt_template": "standard_chat",
        "base_system_prompt": "You are a helpful local assistant."
    }
    
    if "phi3" in model_name:
        profile["display_name"] = "Phi-3 Mini"
        profile["context_limit"] = 128000
    elif "qwen" in model_name:
        profile["display_name"] = "Qwen 2.5"
        profile["base_system_prompt"] = "You are Qwen, a helpful assistant."
        
    return profile