
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, 'hospital.db')

def update_schema():
    if not os.path.exists(DB_FILE):
        print(f"Database file {DB_FILE} not found.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Add file_path column to reports if not exists
    try:
        cursor.execute("ALTER TABLE reports ADD COLUMN file_path TEXT")
        print("Added file_path column to reports table.")
    except sqlite3.OperationalError:
        print("file_path column already exists.")

    conn.commit()
    conn.close()
    print("Database schema updated for file uploads.")

if __name__ == '__main__':
    update_schema()
