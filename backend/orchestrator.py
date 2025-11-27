# backend/orchestrator.py
import json
import logging

from .session_manager import SessionManager 

logger = logging.getLogger(__name__)

class Orchestrator:
    def __init__(self, profiles_module):
        self.profiles = profiles_module
        # Initialize the manager to handle the "Deep Past"
        self.session_manager = SessionManager()

    def build_context_schema(self, user_message, model_name, system_prompt_override, memories, rag_context, history, identity_overrides=None):
        """
        Assembles all context sources into a structured schema.
        """
        user_profile = self.profiles.get_user_profile()
        if identity_overrides:
            user_profile.update(identity_overrides)
            
        model_profile = self.profiles.get_model_profile(model_name)
        
        # Use override if provided, else use model default, else use app default
        sys_prompt = system_prompt_override or model_profile.get("base_system_prompt", "You are a helpful assistant.")

        # [NEW] Fetch the "Deep Past" (Session Summaries)
        # This is the "Falling Edge" that we have compacted.
        session_summary_block = self.session_manager.get_session_summary()
        if not session_summary_block:
            session_summary_block = "New session started."

        schema = {
            "meta": {
                "user_profile": user_profile,
                "model_profile": model_profile,
                "token_estimate": len(user_message) // 4 + 500 # Rough proxy
            },
            "system": sys_prompt,
            "identity": {
                "user_name": user_profile.get("display_name", "User"),
                "workspace": user_profile.get("workspace", "Default"),
                "assistant_name": "LocalMIND Agent"
            },
            "memory": {
                "long_term": memories, # RAG findings or Vector results
                "short_term": session_summary_block # [UPDATED] The Compaction
            },
            "rag_context": rag_context,
            "history": history, # The raw "Rising Edge" (Active Window)
            "current_message": user_message
        }
        return schema

    def render_final_prompt(self, schema):
        """
        Takes the schema and renders the final string based on a template.
        """
        # Extract components
        sys = schema["system"]
        
        ident = schema["identity"]
        identity_block = f"User: {ident['user_name']}\nWorkspace: {ident['workspace']}"
        
        # Format Long-Term Memory (Vector/RAG)
        if schema['memory']['long_term']:
            ltm = "\n".join([f"- {m['content']}" for m in schema['memory']['long_term']])
        else:
            ltm = "No relevant long-term memories."
        
        # [NEW] The Session Context Block (The Summaries)
        session_context = schema['memory']['short_term']
        
        rag = schema['rag_context'] if schema['rag_context'] else "No relevant documents found."
        
        # Format history (The Raw Buffer)
        # We process the entire 'history' list passed to us, assuming the 
        # SessionManager or Main Loop has already handled the window size.
        hist_str = ""
        for h in schema['history']:
            role = "User" if h['role'] == 'user' else "Assistant"
            content = h['content']
            hist_str += f"{role}: {content}\n"

        # Assemble the "Inspector View" Prompt
        # This formatting makes it easy for the human to read in the UI
        final_prompt = f"""=== SYSTEM ===
{sys}

=== IDENTITY ===
{identity_block}

=== PREVIOUS SESSION CONTEXT ===
(Summary of earlier conversation)
{session_context}

=== LONG-TERM MEMORY (RAG) ===
{ltm}

=== RETRIEVED DOCUMENTS ===
{rag}

=== RECENT HISTORY ===
{hist_str}
=== CURRENT MESSAGE ===
User: {schema['current_message']}

Assistant:"""
        
        return final_prompt



