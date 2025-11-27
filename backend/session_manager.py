import logging
import ollama
import sqlite3
from typing import List, Optional

from .database import get_db_connection

logger = logging.getLogger(__name__)

# CONFIGURATION
# How many raw messages to keep in the "Rising Edge" (Active Window)
ACTIVE_WINDOW_SIZE = 10 
# When we compact, how many messages do we group together?
CHUNK_SIZE = 5 

class SessionManager:
    def __init__(self):
        # We could load specific model configs here in the future
        pass

    def get_session_summary(self, session_id: str = "default_session") -> str:
        """
        Retrieves the concatenated summaries of the 'Deep Past'.
        Returns a single string of bulleted history.
        """
        conn = get_db_connection()
        try:
            rows = conn.execute(
                "SELECT content FROM session_summaries WHERE session_id = ? ORDER BY id ASC", 
                (session_id,)
            ).fetchall()
            
            if not rows:
                return ""
            
            # Combine all past chapters into one narrative block
            full_summary = "\n".join([f"- {r['content']}" for r in rows])
            return full_summary
        except Exception as e:
            logger.error(f"Error fetching session summary: {e}")
            return ""
        finally:
            conn.close()

    def check_and_compact(
        self,
        session_id: str = "default_session",
        model_name: str = "qwen2.5:0.5b-instruct",
    ) -> None:
        """
        Checks if the unsummarized raw history exceeds our window.
        If so, it takes the oldest chunk, summarizes it via Ollama, and marks it as done.
        """
        conn = get_db_connection()
        try:
            # 1. Count unsummarized messages
            # We look for messages in this session that have NOT been summarized yet
            count_query = "SELECT COUNT(*) FROM chats WHERE session_id = ? AND is_summarized = 0"
            count = conn.execute(count_query, (session_id,)).fetchone()[0]

            # If we are within the safe window, do nothing
            if count <= ACTIVE_WINDOW_SIZE:
                return

            # 2. We need to compact. Fetch the oldest X unsummarized messages.
            # We order by ID ASC to get the oldest ones first.
            rows_to_compact = conn.execute(
                f"SELECT id, role, content FROM chats WHERE session_id = ? AND is_summarized = 0 ORDER BY id ASC LIMIT {CHUNK_SIZE}",
                (session_id,)
            ).fetchall()

            if not rows_to_compact:
                return

            # 3. Format them for the Summarizer
            text_block = ""
            start_id = rows_to_compact[0]['id']
            end_id = rows_to_compact[-1]['id']
            
            for row in rows_to_compact:
                # Normalize role names for the LLM context
                role_label = "User" if row['role'] == 'user' else "AI"
                text_block += f"{role_label}: {row['content']}\n"

            # 4. Generate Summary via Ollama
            logger.info(f"Compacting session history (IDs {start_id}-{end_id})...")
            
            prompt = f"""
            Compress the following conversation segment into a single concise paragraph.
            Capture the key topics, decisions, or facts mentioned.
            Do not lose technical details (like error codes or library names).
            
            CONVERSATION:
            {text_block}
            
            SUMMARY:
            """
            
            response = ollama.chat(model=model_name, messages=[{'role': 'user', 'content': prompt}])
            summary_content = response['message']['content'].strip()

            # 5. Save Summary & Update Rows
            # A. Insert the new chapter
            conn.execute(
                "INSERT INTO session_summaries (session_id, content, start_chat_id, end_chat_id) VALUES (?, ?, ?, ?)",
                (session_id, summary_content, start_id, end_id)
            )
            
            # B. Mark the original rows as 'is_summarized' so they aren't processed again
            ids = [row['id'] for row in rows_to_compact]
            placeholders = ','.join(['?'] * len(ids))
            conn.execute(
                f"UPDATE chats SET is_summarized = 1 WHERE id IN ({placeholders})",
                ids
            )
            
            conn.commit()
            logger.info(f"Session compaction complete. Created summary chapter for IDs {ids}.")
            
        except Exception as e:
            logger.error(f"Session compaction failed: {e}")
            # Optional: Rollback if you want to be strict, though SQLite auto-rolls back on uncommited connection close usually.
            conn.rollback()
        finally:
            conn.close()