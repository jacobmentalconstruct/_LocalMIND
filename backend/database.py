import sqlite3
import os
import logging
import json

logger = logging.getLogger(__name__)
DB_PATH = "localmind.db"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row # Access columns by name
    return conn

def _migrate_schema(cursor):
    """
    Checks for missing columns in existing tables and alters them if necessary.
    This handles updates on databases that already exist.
    """
    # 1. Check 'chats' table for 'is_summarized' column
    try:
        cursor.execute("PRAGMA table_info(chats)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if columns and 'is_summarized' not in columns:
            logger.info("Migration: Adding 'is_summarized' column to 'chats' table.")
            cursor.execute("ALTER TABLE chats ADD COLUMN is_summarized BOOLEAN DEFAULT 0")
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")

def init_db():
    """Creates tables if they don't exist and performs migrations."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # --- 1. Define Tables (Ideal Schema) ---

    # Users Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            password_hash TEXT,
            display_name TEXT,
            workspace TEXT,
            preferences TEXT
        )
    ''')

    # Model Configs Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS model_configs (
            model_id TEXT PRIMARY KEY,
            display_name TEXT,
            context_limit INTEGER,
            base_system_prompt TEXT
        )
    ''')

    # System Prompts Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_prompts (
            id TEXT PRIMARY KEY,
            name TEXT,
            content TEXT,
            user_id TEXT,
            is_public BOOLEAN DEFAULT 0
        )
    ''')

    # Chats Table
    # Note: If this table exists from an older version, this CREATE is skipped,
    # and the _migrate_schema function handles the missing column.
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            role TEXT,
            content TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            model_used TEXT,
            is_summarized BOOLEAN DEFAULT 0
        )
    ''')

    # Session Summaries Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS session_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            content TEXT,
            start_chat_id INTEGER,
            end_chat_id INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # --- 2. Run Migrations ---
    _migrate_schema(cursor)

    # --- 3. Seed Data ---
    cursor.execute('SELECT count(*) FROM users')
    if cursor.fetchone()[0] == 0:
        logger.info("Seeding default user...")
        default_prefs = json.dumps({
            "style": "structural",
            "detail_level": "high",
            "show_prompt_inspector": True
        })
        cursor.execute(
            "INSERT INTO users (user_id, display_name, workspace, preferences) VALUES (?, ?, ?, ?)",
            ("demo_user", "Jacob", "LocalMIND Lab", default_prefs)
        )

    conn.commit()
    conn.close()
    logger.info("Database initialized and checked.")