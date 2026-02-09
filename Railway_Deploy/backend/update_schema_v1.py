
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

    # Add columns if they don't exist
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN room_number TEXT")
        print("Added room_number column.")
    except sqlite3.OperationalError:
        print("room_number column already exists.")

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN description TEXT")
        print("Added description column.")
    except sqlite3.OperationalError:
        print("description column already exists.")

    # Update doctor records
    doctors_data = {
        'Dr. Nikhil Patil': ('101', 'Expert in general health and primary care.'),
        'Dr. Sagar Patil': ('205', 'Specialist in dental surgery and oral health.'),
        'Dr. Pratiksha Patil': ('310', 'Specializes in ear, nose, and throat disorders.'),
        'Dr. Sharma': ('D-12', 'Expert in bone and joint treatments.'),
        'Dr. Tiwari': ('ICU-1', 'Specialist in heart diseases and surgery.'),
        'Dr. Nethe': ('OPD-4', 'Child healthcare specialist.')
    }

    for name, (room, desc) in doctors_data.items():
        cursor.execute("UPDATE users SET room_number = ?, description = ? WHERE name = ?", (room, desc, name))
    
    conn.commit()
    conn.close()
    print("Database schema and data updated successfully.")

if __name__ == '__main__':
    update_schema()
