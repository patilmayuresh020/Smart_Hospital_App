import sqlite3
import os

# Create DB in the same directory as this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, 'hospital.db')

def init_db():
    if os.path.exists(DB_FILE):
        try:
            os.remove(DB_FILE)
        except PermissionError:
            print(f"Error: Could not delete {DB_FILE}. Is the server running?")
            return
    
    conn = sqlite3.connect(DB_FILE)
    
    # 1. USERS TABLE (Patients & Doctors)
    # Added: role, department, status, queue_current, queue_total
    conn.execute('''
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age INTEGER,
        mobile TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'patient',
        department TEXT,
        status TEXT DEFAULT 'Available',
        queue_current INTEGER DEFAULT 0,
        queue_total INTEGER DEFAULT 0,
        room_number TEXT,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # 2. APPOINTMENTS TABLE
    # Added: doctor_name, match_status
    conn.execute('''
    CREATE TABLE appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dept TEXT NOT NULL,
        doctor_name TEXT,
        date TEXT NOT NULL,
        status TEXT DEFAULT 'Pending',
        user_mobile TEXT NOT NULL,
        patient_name TEXT,
        patient_age INTEGER,
        report_id INTEGER,
        FOREIGN KEY (user_mobile) REFERENCES users (mobile)
    )
    ''')
    
    # 3. REPORTS TABLE
    conn.execute('''
    CREATE TABLE reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER NOT NULL UNIQUE,
        diagnosis TEXT,
        medicines TEXT,
        notes TEXT,
        file_path TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # 4. SYSTEM SETTINGS (Global Fallbacks)
    conn.execute('''
    CREATE TABLE system_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    ''')

    # --- SEED DATA ---
    print("Seeding database...")
    
    # Global Defaults
    conn.execute("INSERT INTO system_settings (key, value) VALUES ('wait_time', '15')")

    # Seed Patient
    conn.execute("INSERT INTO users (name, age, mobile, role) VALUES ('Demo User', 25, '9876543210', 'patient')")
    
    # Seed Doctors (Requested List)
    doctors = [
        ('Dr. Nikhil Patil', 'General Physician', 'admin1', '101', 'Expert in general health and primary care.'),
        ('Dr. Sagar Patil', 'Dental', 'admin2', '205', 'Specialist in dental surgery and oral health.'),
        ('Dr. Pratiksha Patil', 'ENT', 'admin3', '310', 'Specializes in ear, nose, and throat disorders.'),
        ('Dr. Sharma', 'Orthopedic', 'admin4', 'D-12', 'Expert in bone and joint treatments.'),
        ('Dr. Tiwari', 'Cardiology', 'admin5', 'ICU-1', 'Specialist in heart diseases and surgery.'),
        ('Dr. Nethe', 'Pediatrics', 'admin6', 'OPD-4', 'Child healthcare specialist.')
    ]
    
    for name, dept, pwd, room, desc in doctors:
        conn.execute(
            "INSERT INTO users (name, age, mobile, role, department, status, queue_current, queue_total, room_number, description) VALUES (?, ?, ?, 'doctor', ?, 'Available', 0, 0, ?, ?)",
            (name, 45, pwd, dept, room, desc)
        )

    conn.commit()
    conn.close()
    print("Database hospital.db initialized with Multi-Doctor Support.")

if __name__ == '__main__':
    init_db()
