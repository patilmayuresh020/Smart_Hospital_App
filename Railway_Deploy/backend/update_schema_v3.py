import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, 'hospital.db')

def update_schema():
    conn = sqlite3.connect(DB_FILE)
    
    print("Checking 'reports' table columns...")
    cursor = conn.execute("PRAGMA table_info(reports)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'symptoms' not in columns:
        print("Adding 'symptoms' column to 'reports'...")
        try:
            conn.execute("ALTER TABLE reports ADD COLUMN symptoms TEXT")
        except Exception as e:
            print(f"Error adding symptoms: {e}")
            
    if 'follow_up_date' not in columns:
        print("Adding 'follow_up_date' column to 'reports'...")
        try:
            conn.execute("ALTER TABLE reports ADD COLUMN follow_up_date TEXT")
        except Exception as e:
            print(f"Error adding follow_up_date: {e}")

    print("Checking 'messages' table...")
    conn.execute('''
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        subject TEXT,
        message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    print("Messages table verified.")

    conn.commit()
    conn.close()
    print("Schema update completed.")

if __name__ == "__main__":
    update_schema()
