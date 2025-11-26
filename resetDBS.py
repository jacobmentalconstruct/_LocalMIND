# reset_dbs.py
import os
import shutil

def wipe_all():
    print("⚠️  WARNING: This will delete ALL chat history and RAG memories.")
    print("   Target 1: ./localmind.db (SQLite)")
    print("   Target 2: ./chroma_db/   (Vector Store)")
    
    confirm = input("Type 'DELETE' to confirm: ")
    
    if confirm != "DELETE":
        print("Aborted.")
        return

    # 1. Wipe SQLite (The Tape of Truth)
    try:
        if os.path.exists("localmind.db"):
            os.remove("localmind.db")
            print("✅ SQLite DB deleted.")
        else:
            print("ℹ️  SQLite DB not found.")
    except Exception as e:
        print(f"❌ Error deleting SQLite: {e}")

    # 2. Wipe Chroma (The Vector Store)
    try:
        if os.path.exists("chroma_db"):
            shutil.rmtree("chroma_db")
            print("✅ ChromaDB folder deleted.")
        else:
            print("ℹ️  ChromaDB folder not found.")
    except Exception as e:
        print(f"❌ Error deleting ChromaDB: {e}")

    print("\n✨ System Clean. Restart the backend to re-initialize fresh DBs.")

if __name__ == "__main__":
    wipe_all()