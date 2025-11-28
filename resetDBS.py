# reset_dbs.py
import os
import shutil
import stat
import time

def handle_remove_readonly(func, path, exc):
    """
    Error handler for shutil.rmtree.
    If the file is read-only (common in Windows/Git), mark it as writable and retry.
    """
    excvalue = exc[1]
    if func in (os.rmdir, os.remove, os.unlink) and excvalue.errno == 13:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    else:
        raise

def wipe_all():
    print("===============================================================")
    print("               🚨 LOCALMIND FACTORY RESET 🚨")
    print("===============================================================")
    print("This will forcefully delete:")
    print(f"  1. SQLite DB:   {os.path.abspath('localmind.db')}")
    print(f"  2. Vector DB:   {os.path.abspath('chroma_db')}")
    print("\n⚠️  CRITICAL: YOU MUST CLOSE THE BACKEND SERVER TERMINAL FIRST.")
    print("If the server is running, these files are locked and cannot be deleted.")
    print("===============================================================")
    
    confirm = input("Type 'DELETE' to confirm: ")
    
    if confirm != "DELETE":
        print("Aborted.")
        return

    # 1. Wipe SQLite
    db_path = "localmind.db"
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
            print(f"✅ SQLite DB deleted: {db_path}")
        except PermissionError:
            print(f"❌ ERROR: Could not delete '{db_path}'.")
            print("   The file is currently in use. STOP THE SERVER and try again.")
            return
        except Exception as e:
            print(f"❌ Error deleting SQLite: {e}")
    else:
        print(f"ℹ️  SQLite DB not found (already clean).")

    # 2. Wipe Chroma
    chroma_path = "chroma_db"
    if os.path.exists(chroma_path):
        try:
            # Retry loop for Windows file system lag
            shutil.rmtree(chroma_path, ignore_errors=False, onerror=handle_remove_readonly)
            print(f"✅ ChromaDB folder deleted: {chroma_path}")
        except PermissionError:
            print(f"❌ ERROR: Could not delete '{chroma_path}'.")
            print("   The database is locked. STOP THE SERVER and try again.")
            return
        except Exception as e:
            print(f"❌ Error deleting ChromaDB: {e}")
    else:
        print(f"ℹ️  ChromaDB folder not found (already clean).")

    print("\n✨ System Clean. Restart the backend to re-initialize fresh DBs.")

if __name__ == "__main__":
    wipe_all()