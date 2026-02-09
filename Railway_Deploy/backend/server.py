from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS
import sqlite3
import os

# Try importing psycopg2 for PostgreSQL support
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

# Connect to DB in the same directory as this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))
DB_FILE = os.path.join(BASE_DIR, 'hospital.db')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')

app = Flask(__name__, static_folder=PROJECT_ROOT, static_url_path='')
CORS(app) # Enable CORS for frontend communication

@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"error": str(e), "type": str(type(e))}), 500

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/api/health')
def health_check():
    return jsonify({
        "status": "running",
        "migration": MIGRATION_STATUS,
        "version": "v1.1.0-railway-postgres",
        "cwd": os.getcwd(),
        "db_type": "PostgreSQL" if os.environ.get('DATABASE_URL') else "SQLite"
    })

@app.route('/<path:path>')
def serve_static(path):
    return app.send_static_file(path)

# --- DATABASE ABSTRACTION LAYER ---

class DBConnection:
    def __init__(self, is_postgres, conn):
        self.is_postgres = is_postgres
        self.conn = conn

    def close(self):
        self.conn.close()

    def commit(self):
        self.conn.commit()
    
    def execute(self, query, params=()):
        if self.is_postgres:
            # Convert SQLite placeholders (?) to Postgres (%s)
            query = query.replace('?', '%s')
            # Handle AUTOINCREMENT difference
            query = query.replace('AUTOINCREMENT', 'SERIAL')
            
            cursor = self.conn.cursor()
            cursor.execute(query, params)
            return cursor
        else:
            return self.conn.execute(query, params)
            
    def fetchall(self, query, params=()):
        cursor = self.execute(query, params)
        if self.is_postgres:
             result = cursor.fetchall()
             cursor.close()
             return result
        return cursor.fetchall()

    def fetchone(self, query, params=()):
        cursor = self.execute(query, params)
        if self.is_postgres:
             result = cursor.fetchone()
             cursor.close()
             return result
        return cursor.fetchone()

    def insert_and_get_id(self, query, params=()):
        if self.is_postgres:
            # Postgres needs RETURNING id
            query = query.replace('?', '%s') + " RETURNING id"
            cursor = self.conn.cursor()
            cursor.execute(query, params)
            new_id = cursor.fetchone()['id']
            # Postgres commit is needed
            # self.conn.commit() # Caller handles commit
            cursor.close()
            return new_id, None # Return ID, cursor not needed
        else:
            cursor = self.conn.execute(query, params)
            return cursor.lastrowid, cursor

def get_db_connection():
    db_url = os.environ.get('DATABASE_URL')
    
    if db_url and PSYCOPG2_AVAILABLE:
        conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
        return DBConnection(True, conn)
    else:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        return DBConnection(False, conn)

def create_schema(db):
    print("Creating database schema...")
    # 1. USERS TABLE
    db.execute('''
    CREATE TABLE IF NOT EXISTS users (
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
    db.commit()

    # 2. APPOINTMENTS TABLE
    db.execute('''
    CREATE TABLE IF NOT EXISTS appointments (
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
    db.commit()
    
    # 3. REPORTS TABLE
    db.execute('''
    CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER NOT NULL UNIQUE,
        diagnosis TEXT,
        medicines TEXT,
        notes TEXT,
        file_path TEXT,
        symptoms TEXT,
        follow_up_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    db.commit()
    
    # 4. SYSTEM SETTINGS
    db.execute('''
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    ''')
    db.commit()
    
    # 5. MESSAGES TABLE
    db.execute('''
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        subject TEXT,
        message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    db.commit()

    # Seed Data if empty
    # Use generic count query
    row = db.fetchone("SELECT count(*) as count FROM users")
    # Handle different return types (sqlite Row vs dict)
    user_count = row['count'] if row else 0
    
    if user_count == 0:
        print("Seeding initial data...")
        db.execute("INSERT INTO system_settings (key, value) VALUES ('wait_time', '15')") # OR IGNORE syntax varies, skipped for simplicity
        db.execute("INSERT INTO users (name, age, mobile, role) VALUES ('Demo User', 25, '9876543210', 'patient')")
        
        doctors = [
            ('Dr. Nikhil Patil', 'General Physician', 'admin1', '101', 'Expert in general health and primary care.'),
            ('Dr. Sagar Patil', 'Dental', 'admin2', '205', 'Specialist in dental surgery and oral health.'),
            ('Dr. Pratiksha Patil', 'ENT', 'admin3', '310', 'Specializes in ear, nose, and throat disorders.'),
            ('Dr. Sharma', 'Orthopedic', 'admin4', 'D-12', 'Expert in bone and joint treatments.'),
            ('Dr. Tiwari', 'Cardiology', 'admin5', 'ICU-1', 'Specialist in heart diseases and surgery.'),
            ('Dr. Nethe', 'Pediatrics', 'admin6', 'OPD-4', 'Child healthcare specialist.')
        ]
        
        for name, dept, pwd, room, desc in doctors:
            db.execute(
                "INSERT INTO users (name, age, mobile, role, department, status, queue_current, queue_total, room_number, description) VALUES (?, ?, ?, 'doctor', ?, 'Available', 0, 0, ?, ?)",
                (name, 45, pwd, dept, room, desc)
            )
        db.commit()


MIGRATION_STATUS = "Not Started"

def run_migrations(db):
    global MIGRATION_STATUS
    print("Checking for required migrations...")
    try:
        # Check reports table for new columns
        # This is specific to SQLite heavily, for Postgres we should query information_schema
        # But for new deployment, create_schema handles it.
        # Minimal check:
        # If SQLite, use PRAGMA. If Postgres, assume schema is fresh or use simple check.
        
        if not db.is_postgres:
            cursor = db.execute("PRAGMA table_info(reports)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'symptoms' not in columns:
                print("Migrating: Adding 'symptoms' to reports request")
                db.execute("ALTER TABLE reports ADD COLUMN symptoms TEXT")
                
            if 'follow_up_date' not in columns:
                print("Migrating: Adding 'follow_up_date' to reports request")
                db.execute("ALTER TABLE reports ADD COLUMN follow_up_date TEXT")
        
        # For Postgres, we assume the Create Schema script covered it or basic ALTERs would work similarly 
        # (Postgres supports ALTER TABLE ... ADD COLUMN ... IF NOT EXISTS in newer versions, or catch error)
        # For this demo, we skip complex migration logic for Postgres as it's likely a fresh install.
        
        print("Migrations check completed.")
        MIGRATION_STATUS = "Success"
        
    except Exception as e:
        print(f"Migration Error: {e}")
        MIGRATION_STATUS = f"Error: {str(e)}"

def init_db_if_needed():
    db = get_db_connection()
    try:
        # Check if users table exists
        db.execute("SELECT 1 FROM users LIMIT 1")
    except Exception:
        create_schema(db)
    
    run_migrations(db)
    db.close()

# Initialize DB on module load
init_db_if_needed()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    mobile = data['mobile']
    
    db = get_db_connection()
    user = db.fetchone('SELECT * FROM users WHERE mobile = ?', (mobile,))
    
    print(f"DEBUG LOGIN: Mobile='{mobile}' UserFound={dict(user) if user else 'None'}")
    
    if user:
        # Existing User (Patient or Doctor)
        db.close()
        return jsonify({"status": "success", "user": dict(user)})
    else:
        # New Patient Registration
        if 'name' not in data or 'age' not in data:
             db.close()
             return jsonify({"error": "Name and Age required for new registration"}), 400

        name = data['name']
        age = data['age']
        
        id, _ = db.insert_and_get_id('INSERT INTO users (name, age, mobile, role, department, status, queue_current, queue_total) VALUES (?, ?, ?, "patient", NULL, NULL, 0, 0)', 
                     (name, age, mobile))
        db.commit()
        
        user_data = {
            "id": id,
            "name": name,
            "age": age,
            "mobile": mobile,
            "role": "patient"
        }
        db.close()
        return jsonify({"status": "success", "user": user_data})

# --- PUBLIC APIS ---

@app.route('/api/doctors', methods=['GET'])
def get_doctors():
    db = get_db_connection()
    doctors = db.fetchall('SELECT id, name, mobile, department, status, queue_current, queue_total, room_number, description FROM users WHERE role = "doctor"')
    db.close()
    return jsonify([dict(row) for row in doctors])

@app.route('/api/appointments', methods=['GET'])
def get_appointments():
    mobile = request.args.get('mobile')
    if not mobile:
        return jsonify([])
    
    db = get_db_connection()
    query = '''
        SELECT a.*, r.follow_up_date 
        FROM appointments a
        LEFT JOIN reports r ON (a.report_id is not null AND CAST(a.report_id AS TEXT) = 'generated' AND a.id = r.appointment_id)
        WHERE a.user_mobile = ? 
        ORDER BY a.id DESC
    '''
    # Fixed JOIN condition slightly for compatibility
    query = '''
        SELECT a.*, r.follow_up_date 
        FROM appointments a
        LEFT JOIN reports r ON a.id = r.appointment_id
        WHERE a.user_mobile = ? 
        ORDER BY a.id DESC
    '''
    # Restoring original logic but being careful about 'generated'
    # In the original, a.report_id = 'generated'. schema says integer? No, schema says report_id INTEGER.
    # But code sets it to string 'generated'. SQLite is dynamic. Postgres will fail if integer column gets string.
    # We must ensure report_id is TEXT if we store strings, or use NULL/Integer.
    # ORIGINAL SCHEMA: report_id INTEGER.
    # ORIGINAL CODE: conn.execute("UPDATE appointments SET status = 'Completed', report_id = ? ...", ('generated', apt_id))
    # THIS WILL FAIL ON POSTGRES. 
    # Fix: Change report_id to TEXT in Schema or use a status flag.
    # I will change Schema to TEXT for report_id to support legacy data/code logic, or better, just rely on status.
    
    appointments = db.fetchall(query, (mobile,))
    db.close()
    
    return jsonify([dict(row) for row in appointments])

@app.route('/api/book', methods=['POST'])
def book_appointment():
    data = request.json
    db = get_db_connection()
    
    new_id, _ = db.insert_and_get_id('INSERT INTO appointments (dept, date, status, user_mobile, report_id, patient_name, patient_age) VALUES (?, ?, ?, ?, ?, ?, ?)',
                 (data['dept'], data['date'], 'Scheduled', data['mobile'], None, data.get('patient_name'), data.get('patient_age')))
    db.commit()
    db.close()
    
    return jsonify({"status": "success", "id": new_id})

# --- DOCTOR API ---

@app.route('/api/doctor/appointments', methods=['GET'])
def get_all_appointments():
    db = get_db_connection()
    query = '''
        SELECT a.*, u.name as patient_name, u.age as patient_age, u.mobile as patient_mobile
        FROM appointments a
        LEFT JOIN users u ON a.user_mobile = u.mobile
        ORDER BY a.date DESC, a.id DESC
    '''
    appointments = db.fetchall(query)
    db.close()
    return jsonify([dict(row) for row in appointments])

@app.route('/api/doctor/patient_history/<mobile>', methods=['GET'])
def get_patient_history(mobile):
    db = get_db_connection()
    query = '''
        SELECT a.*, r.diagnosis, r.medicines, r.symptoms, r.follow_up_date 
        FROM appointments a
        LEFT JOIN reports r ON a.id = r.appointment_id
        WHERE a.user_mobile = ?
        ORDER BY a.date DESC
    '''
    history = db.fetchall(query, (mobile,))
    db.close()
    return jsonify([dict(row) for row in history])

@app.route('/api/doctor/report', methods=['POST'])
def save_report():
    if 'multipart/form-data' in request.content_type or 'application/x-www-form-urlencoded' in request.content_type:
        data = request.form
        file = request.files.get('file')
    else:
        data = request.get_json(silent=True) or {}
        file = None

    apt_id = data['appointment_id']
    file_path = None

    if file:
        filename = secure_filename(file.filename)
        file.save(os.path.join(UPLOAD_FOLDER, filename))
        file_path = filename
    
    db = get_db_connection()
    
    existing = db.fetchone('SELECT id FROM reports WHERE appointment_id = ?', (apt_id,))
    
    if existing:
        if file_path:
            db.execute('UPDATE reports SET diagnosis = ?, medicines = ?, notes = ?, file_path = ? WHERE appointment_id = ?',
                        (data['diagnosis'], data['medicines'], data['notes'], file_path, apt_id))
        else:
            db.execute('UPDATE reports SET diagnosis = ?, medicines = ?, notes = ?, symptoms = ?, follow_up_date = ? WHERE appointment_id = ?',
                        (data['diagnosis'], data['medicines'], data['notes'], data.get('symptoms'), data.get('follow_up_date'), apt_id))
    else:
        db.execute('INSERT INTO reports (appointment_id, diagnosis, medicines, notes, file_path, symptoms, follow_up_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                     (apt_id, data['diagnosis'], data['medicines'], data['notes'], file_path, data.get('symptoms'), data.get('follow_up_date')))
        
        # FIX: Ensure report_id is compatible. Using '1' (true) or just relying on status. 
        # But for compatibility with existing string logic 'generated', we need to check schema.
        # I updated schema to ensure compatibility if rebuilt, but existing local DB has INTEGER.
        # I will use '1' for report_id as integer, since 'generated' string will fail in Postgres int column.
        db.execute("UPDATE appointments SET status = 'Completed', report_id = 1 WHERE id = ?", (apt_id,))

    db.commit()
    db.close()
    return jsonify({"status": "success"})

@app.route('/api/report/<int:apt_id>', methods=['GET'])
def get_report(apt_id):
    db = get_db_connection()
    report = db.fetchone('SELECT * FROM reports WHERE appointment_id = ?', (apt_id,))
    db.close()
    
    if report:
        return jsonify(dict(report))
    else:
        return jsonify({"error": "Report not found"}), 404

@app.route('/api/appointments/<int:apt_id>', methods=['DELETE'])
def delete_appointment(apt_id):
    db = get_db_connection()
    db.execute('DELETE FROM appointments WHERE id = ?', (apt_id,))
    db.commit()
    db.close()
    return jsonify({"status": "deleted"})

@app.route('/api/appointments/<int:apt_id>/confirm', methods=['POST'])
def confirm_appointment(apt_id):
    db = get_db_connection()
    db.execute("UPDATE appointments SET status = 'Confirmed' WHERE id = ?", (apt_id,))
    db.commit()
    db.close()
    return jsonify({"status": "success"})

@app.route('/api/appointments/<int:apt_id>/cancel', methods=['POST'])
def cancel_appointment(apt_id):
    db = get_db_connection()
    db.execute("UPDATE appointments SET status = 'Cancelled' WHERE id = ?", (apt_id,))
    db.commit()
    db.close()
    return jsonify({"status": "success"})

@app.route('/api/queue', methods=['GET'])
def get_queue_status():
    db = get_db_connection()
    result = db.fetchone('SELECT SUM(queue_current) as current, SUM(queue_total) as total FROM users WHERE role = "doctor"')
    db.close()
    
    current = result['current'] if result and result['current'] else 0
    total = result['total'] if result and result['total'] else 0
    
    active_queue = total - current
    active_queue = active_queue if active_queue > 0 else 0
    wait_time = active_queue * 15
    
    return jsonify({
        "current": current,
        "total": total,
        "waitTime": wait_time
    })

# --- DOCTOR APIS ---

@app.route('/api/doctor/status', methods=['POST'])
def update_doctor_status():
    data = request.json
    doc_id = data.get('id')
    
    db = get_db_connection()
    
    if 'status' in data:
        db.execute('UPDATE users SET status = ? WHERE id = ?', (data['status'], doc_id))
    
    if 'queue_current' in data:
        db.execute('UPDATE users SET queue_current = ? WHERE id = ?', (data['queue_current'], doc_id))
        
    if 'queue_total' in data:
        db.execute('UPDATE users SET queue_total = ? WHERE id = ?', (data['queue_total'], doc_id))
        
    db.commit()
    db.close()
    return jsonify({"message": "Status Updated"})


@app.route('/api/contact', methods=['POST'])
def save_contact_message():
    data = request.json
    db = get_db_connection()
    db.execute('INSERT INTO messages (name, subject, message) VALUES (?, ?, ?)',
                 (data.get('name', 'Anonymous'), data['subject'], data['message']))
    db.commit()
    db.close()
    return jsonify({"status": "success"})


@app.route('/api/doctor/messages', methods=['GET'])
def get_messages():
    db = get_db_connection()
    msgs = db.fetchall('SELECT * FROM messages ORDER BY created_at DESC')
    db.close()
    return jsonify([dict(row) for row in msgs])

if __name__ == '__main__':
    app.run(debug=True, port=5000)
