from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS
import sqlite3
import os

# Connect to DB in the same directory as this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))
DB_FILE = os.path.join(BASE_DIR, 'hospital.db')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')

app = Flask(__name__, static_folder=PROJECT_ROOT, static_url_path='')
CORS(app) # Enable CORS for frontend communication


if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/<path:path>')
def serve_static(path):
    return app.send_static_file(path)

@app.route('/api/debug_fs')
def debug_fs():
    import os
    try:
        current = os.getcwd()
        ls_current = os.listdir(current)
        ls_root = os.listdir(PROJECT_ROOT)
        return jsonify({
            "cwd": current, 
            "ls_cwd": ls_current,
            "project_root": PROJECT_ROOT,
            "ls_root": ls_root,
            "static_folder": app.static_folder
        })
    except Exception as e:
        return jsonify({"error": str(e)})

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def create_schema(conn):
    print("Creating database schema...")
    # 1. USERS TABLE
    conn.execute('''
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

    # 2. APPOINTMENTS TABLE
    conn.execute('''
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
    
    # 3. REPORTS TABLE
    conn.execute('''
    CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER NOT NULL UNIQUE,
        diagnosis TEXT,
        medicines TEXT,
        notes TEXT,
        file_path TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # 4. SYSTEM SETTINGS
    conn.execute('''
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    ''')

    # Seed Data if empty
    user_count = conn.execute("SELECT count(*) FROM users").fetchone()[0]
    if user_count == 0:
        print("Seeding initial data...")
        conn.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('wait_time', '15')")
        conn.execute("INSERT INTO users (name, age, mobile, role) VALUES ('Demo User', 25, '9876543210', 'patient')")
        
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

def init_db_if_needed():
    # Ensure DB exists
    conn = sqlite3.connect(DB_FILE)
    try:
        # Check if users table exists
        conn.execute("SELECT 1 FROM users LIMIT 1")
    except sqlite3.OperationalError:
        create_schema(conn)
    finally:
        conn.close()

# Initialize DB on module load (for Gunicorn)
init_db_if_needed()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    mobile = data['mobile']
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE mobile = ?', (mobile,)).fetchone()
    
    print(f"DEBUG LOGIN: Mobile='{mobile}' UserFound={dict(user) if user else 'None'}")
    
    if user:
        # Existing User (Patient or Doctor)
        conn.close()
        return jsonify({"status": "success", "user": dict(user)})
    else:
        # New Patient Registration
        if 'name' not in data or 'age' not in data:
             conn.close()
             return jsonify({"error": "Name and Age required for new registration"}), 400

        name = data['name']
        age = data['age']
        
        conn.execute('INSERT INTO users (name, age, mobile, role, department, status, queue_current, queue_total) VALUES (?, ?, ?, "patient", NULL, NULL, 0, 0)', 
                     (name, age, mobile))
        conn.commit()
        
        user_data = {
            "id": conn.execute('SELECT last_insert_rowid()').fetchone()[0],
            "name": name,
            "age": age,
            "mobile": mobile,
            "role": "patient"
        }
        conn.close()
        return jsonify({"status": "success", "user": user_data})

# --- PUBLIC APIS ---

@app.route('/api/doctors', methods=['GET'])
def get_doctors():
    conn = get_db_connection()
    # Added mobile to query so frontend can use it for login ID
    doctors = conn.execute('SELECT id, name, mobile, department, status, queue_current, queue_total, room_number, description FROM users WHERE role = "doctor"').fetchall()
    conn.close()
    return jsonify([dict(row) for row in doctors])

@app.route('/api/appointments', methods=['GET'])
def get_appointments():
    mobile = request.args.get('mobile')
    if not mobile:
        return jsonify([])
    
    conn = get_db_connection()
    appointments = conn.execute('SELECT * FROM appointments WHERE user_mobile = ? ORDER BY id DESC', (mobile,)).fetchall()
    conn.close()
    
    return jsonify([dict(row) for row in appointments])

@app.route('/api/book', methods=['POST'])
def book_appointment():
    data = request.json
    conn = get_db_connection()
    
    cursor = conn.execute('INSERT INTO appointments (dept, date, status, user_mobile, report_id) VALUES (?, ?, ?, ?, ?)',
                 (data['dept'], data['date'], 'Scheduled', data['mobile'], None))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    
    new_id = cursor.lastrowid
    conn.close()
    
    return jsonify({"status": "success", "id": new_id})

# --- DOCTOR API ---

@app.route('/api/doctor/appointments', methods=['GET'])
def get_all_appointments():
    conn = get_db_connection()
    # Join with users to get patient names
    query = '''
        SELECT a.*, u.name as patient_name, u.age as patient_age, u.mobile as patient_mobile
        FROM appointments a
        LEFT JOIN users u ON a.user_mobile = u.mobile
        ORDER BY a.date DESC, a.id DESC
    '''
    appointments = conn.execute(query).fetchall()
    conn.close()
    return jsonify([dict(row) for row in appointments])

@app.route('/api/doctor/patient_history/<mobile>', methods=['GET'])
def get_patient_history(mobile):
    conn = get_db_connection()
    # Fetch all appointments for this mobile that are completed
    query = '''
        SELECT a.*, r.diagnosis, r.medicines, r.symptoms, r.follow_up_date 
        FROM appointments a
        LEFT JOIN reports r ON a.report_id = 'generated' AND a.id = r.appointment_id
        WHERE a.user_mobile = ?
        ORDER BY a.date DESC
    '''
    history = conn.execute(query, (mobile,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in history])

@app.route('/api/doctor/report', methods=['POST'])
def save_report():
    # Handle both JSON and FormData
    if request.content_type.startswith('multipart/form-data'):
        data = request.form
        file = request.files.get('file')
    else:
        data = request.json
        file = None

    apt_id = data['appointment_id']
    file_path = None

    if file:
        filename = secure_filename(file.filename)
        file.save(os.path.join(UPLOAD_FOLDER, filename))
        file_path = filename
    
    conn = get_db_connection()
    
    # Check if report exists
    existing = conn.execute('SELECT id FROM reports WHERE appointment_id = ?', (apt_id,)).fetchone()
    
    if existing:
        if file_path:
            conn.execute('UPDATE reports SET diagnosis = ?, medicines = ?, notes = ?, file_path = ? WHERE appointment_id = ?',
                        (data['diagnosis'], data['medicines'], data['notes'], file_path, apt_id))
        else:
            conn.execute('UPDATE reports SET diagnosis = ?, medicines = ?, notes = ?, symptoms = ?, follow_up_date = ? WHERE appointment_id = ?',
                        (data['diagnosis'], data['medicines'], data['notes'], data.get('symptoms'), data.get('follow_up_date'), apt_id))
    else:
        conn.execute('INSERT INTO reports (appointment_id, diagnosis, medicines, notes, file_path, symptoms, follow_up_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                     (apt_id, data['diagnosis'], data['medicines'], data['notes'], file_path, data.get('symptoms'), data.get('follow_up_date')))
        
        # Update Appointment status
        conn.execute("UPDATE appointments SET status = 'Completed', report_id = ? WHERE id = ?", 
                     ('generated', apt_id))

    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

@app.route('/api/report/<int:apt_id>', methods=['GET'])
def get_report(apt_id):
    conn = get_db_connection()
    report = conn.execute('SELECT * FROM reports WHERE appointment_id = ?', (apt_id,)).fetchone()
    conn.close()
    
    if report:
        return jsonify(dict(report))
    else:
        return jsonify({"error": "Report not found"}), 404

@app.route('/api/appointments/<int:apt_id>', methods=['DELETE'])
def delete_appointment(apt_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM appointments WHERE id = ?', (apt_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "deleted"})

@app.route('/api/appointments/<int:apt_id>/confirm', methods=['POST'])
def confirm_appointment(apt_id):
    conn = get_db_connection()
    conn.execute("UPDATE appointments SET status = 'Confirmed' WHERE id = ?", (apt_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

@app.route('/api/appointments/<int:apt_id>/cancel', methods=['POST'])
def cancel_appointment(apt_id):
    conn = get_db_connection()
    conn.execute("UPDATE appointments SET status = 'Cancelled' WHERE id = ?", (apt_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

@app.route('/api/queue', methods=['GET'])
def get_queue_status():
    conn = get_db_connection()
    # Aggregate data from all doctors
    result = conn.execute('SELECT SUM(queue_current) as current, SUM(queue_total) as total FROM users WHERE role = "doctor"').fetchone()
    conn.close()
    
    current = result['current'] if result['current'] else 0
    total = result['total'] if result['total'] else 0
    
    # Simple logic regarding wait time (e.g., 5 mins per patient in queue)
    # This is just a global average estimatation
    active_queue = total - current
    active_queue = active_queue if active_queue > 0 else 0
    wait_time = active_queue * 15 # default 15 mins per patient
    
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
    
    conn = get_db_connection()
    
    if 'status' in data:
        conn.execute('UPDATE users SET status = ? WHERE id = ?', (data['status'], doc_id))
    
    if 'queue_current' in data:
        conn.execute('UPDATE users SET queue_current = ? WHERE id = ?', (data['queue_current'], doc_id))
        
    if 'queue_total' in data:
        conn.execute('UPDATE users SET queue_total = ? WHERE id = ?', (data['queue_total'], doc_id))
        
    conn.commit()
    conn.close()
    return jsonify({"message": "Status Updated"})


@app.route('/api/contact', methods=['POST'])
def save_contact_message():
    data = request.json
    conn = get_db_connection()
    conn.execute('INSERT INTO messages (name, subject, message) VALUES (?, ?, ?)',
                 (data.get('name', 'Anonymous'), data['subject'], data['message']))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})


@app.route('/api/doctor/messages', methods=['GET'])
def get_messages():
    conn = get_db_connection()
    msgs = conn.execute('SELECT * FROM messages ORDER BY created_at DESC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in msgs])


# CONFLICTING ROUTE REMOVED
# @app.route('/api/queue', methods=['GET'])
# def get_queue():
#     # Fetch real queue from settings
#     conn = get_db_connection()
#     rows = conn.execute('SELECT * FROM system_settings WHERE key IN ("queue_current", "queue_total", "wait_time")').fetchall()
#     conn.close()
#     
#     data = {row['key']: row['value'] for row in rows}
#     
#     return jsonify({
#         "current": int(data.get('queue_current', 0)),
#         "total": int(data.get('queue_total', 0)),
#         "waitTime": int(data.get('wait_time', 15))
#     })



