from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from flask_cors import CORS
import sqlite3
import os

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    psycopg2 = None
    RealDictCursor = None

# Connect to DB: Use PostgreSQL if DATABASE_URL is set (Render), else SQLite (Local)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))
DB_FILE = os.path.join(BASE_DIR, 'hospital.db')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
DATABASE_URL = os.environ.get('DATABASE_URL')

app = Flask(__name__, static_folder=PROJECT_ROOT, static_url_path='')
CORS(app)

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

@app.route('/admin')
def serve_admin():
    response = app.send_static_file('admin.html')
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.route('/api/health')
def health_check():
    db_type = "PostgreSQL" if DATABASE_URL else "SQLite"
    return jsonify({
        "status": "running",
        "migration": MIGRATION_STATUS,
        "version": "v2.0.0-hybrid-db",
        "db_type": db_type
    })

@app.route('/<path:path>')
def serve_static(path):
    return app.send_static_file(path)

def get_db_connection():
    if DATABASE_URL:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    else:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
    return conn

def execute_query(query, params=(), fetchone=False, fetchall=False, commit=False):
    conn = get_db_connection()
    try:
        if DATABASE_URL:
            # Postgres specific: placeholders are %s
            query = query.replace('?', '%s')
            
        cur = conn.cursor()
        cur.execute(query, params)
        
        if commit:
            conn.commit()
            if DATABASE_URL:
                # Postgres RETURNING id handling if needed but usually separate
                pass
            return cur # return cursor for lastrowid access if needed
            
        if fetchone:
            result = cur.fetchone()
            return dict(result) if result else None
            
        if fetchall:
            result = cur.fetchall()
            return [dict(row) for row in result]
            
    finally:
        conn.close()

def create_schema(conn):
    print("Creating database schema...")
    cur = conn.cursor()
    
    # 1. USERS TABLE
    cur.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''' if DATABASE_URL else '''
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
    cur.execute('''
    CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        dept TEXT NOT NULL,
        doctor_name TEXT,
        date TEXT NOT NULL,
        status TEXT DEFAULT 'Pending',
        user_mobile TEXT NOT NULL,
        patient_name TEXT,
        patient_age INTEGER,
        report_id TEXT, -- Changed to TEXT to allow 'generated'
        FOREIGN KEY (user_mobile) REFERENCES users (mobile)
    )
    ''' if DATABASE_URL else '''
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
    cur.execute('''
    CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL UNIQUE,
        diagnosis TEXT,
        medicines TEXT,
        notes TEXT,
        file_path TEXT,
        symptoms TEXT,
        follow_up_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''' if DATABASE_URL else '''
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
    
    # 4. SYSTEM SETTINGS
    cur.execute('''
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    ''')
    
    # 5. MESSAGES TABLE
    cur.execute('''
    CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        name TEXT,
        subject TEXT,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''' if DATABASE_URL else '''
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        subject TEXT,
        message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    conn.commit()

    # Seed Data if empty
    cur.execute("SELECT count(*) FROM users")
    result = cur.fetchone()
    user_count = result[0] if result else 0
    
    # Check if this fetchone returning dict or tuple?
    # sqlite3.Row -> acts like dict and tuple
    # psycopg2 -> RealDictCursor -> Dict
    # But wait, create_schema calls conn.fetchone? No, cur.fetchone
    # If RealDictCursor, result is {'count': 0} or similar.
    # To be safe, let's normalize access.
    
    if isinstance(user_count, dict):
        # Depending on query, key might vary.
        # "SELECT count(*)" -> key "count" usually
        user_count = list(user_count.values())[0]

    if user_count == 0:
        print("Seeding initial data...")
        placeholders = "%s" if DATABASE_URL else "?"
        
        # System Settings
        try:
             cur.execute(f"INSERT INTO system_settings (key, value) VALUES ({placeholders}, {placeholders})", ('wait_time', '15'))
        except:
             pass # might exist
             
        # Demo Patient
        cur.execute(f"INSERT INTO users (name, age, mobile, role) VALUES ({placeholders}, {placeholders}, {placeholders}, {placeholders})", 
                   ('Demo User', 25, '9876543210', 'patient'))
        
        doctors = [
            ('Dr. Nikhil Patil', 'General Physician', 'admin1', '101', 'Expert in general health and primary care.'),
            ('Dr. Sagar Patil', 'Dental', 'admin2', '205', 'Specialist in dental surgery and oral health.'),
            ('Dr. Pratiksha Patil', 'ENT', 'admin3', '310', 'Specializes in ear, nose, and throat disorders.'),
            ('Dr. Sharma', 'Orthopedic', 'admin4', 'D-12', 'Expert in bone and joint treatments.'),
            ('Dr. Tiwari', 'Cardiology', 'admin5', 'ICU-1', 'Specialist in heart diseases and surgery.'),
            ('Dr. Nethe', 'Pediatrics', 'admin6', 'OPD-4', 'Child healthcare specialist.')
        ]
        
        for name, dept, pwd, room, desc in doctors:
            cur.execute(
                f"INSERT INTO users (name, age, mobile, role, department, status, queue_current, queue_total, room_number, description) VALUES ({placeholders}, {placeholders}, {placeholders}, 'doctor', {placeholders}, 'Available', 0, 0, {placeholders}, {placeholders})",
                (name, 45, pwd, dept, room, desc)
            )
        conn.commit()


MIGRATION_STATUS = "Not Started"

def run_migrations(conn):
    global MIGRATION_STATUS
    print("Checking for required migrations...")
    cur = conn.cursor()
    try:
        # Check reports table for new columns
        # Logic differs significantly for Postgres vs SQLite logic for PRAGMA
        
        if DATABASE_URL:
             # Postgres migration check
             cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'reports'")
             columns = [row['column_name'] for row in cur.fetchall()]
        else:
             # SQLite
             cur.execute("PRAGMA table_info(reports)")
             columns = [row['name'] for row in cur.fetchall()] # row is sqlite3.Row, has name access
        
        if 'symptoms' not in columns:
            print("Migrating: Adding 'symptoms' to reports request")
            cur.execute("ALTER TABLE reports ADD COLUMN symptoms TEXT")
            
        if 'follow_up_date' not in columns:
            print("Migrating: Adding 'follow_up_date' to reports request")
            cur.execute("ALTER TABLE reports ADD COLUMN follow_up_date TEXT")
            
        conn.commit()
        print("Migrations check completed.")
        MIGRATION_STATUS = "Success"
        
    except Exception as e:
        print(f"Migration Error: {e}")
        conn.rollback()
        MIGRATION_STATUS = f"Error: {str(e)}"

def init_db_if_needed():
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        # Check if users table exists
        try:
            cur.execute("SELECT 1 FROM users LIMIT 1")
        except (sqlite3.OperationalError, psycopg2.Error if psycopg2 else sqlite3.OperationalError):
            conn.rollback()
            create_schema(conn)
    
        run_migrations(conn)
        conn.close()
    except Exception as e:
        print(f"DB Init Error: {e}")



@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    mobile = data['mobile']
    
    # Use execute_query helper
    user = execute_query('SELECT * FROM users WHERE mobile = ?', (mobile,), fetchone=True)
    
    print(f"DEBUG LOGIN: Mobile='{mobile}' UserFound={user if user else 'None'}")
    
    if user:
        # Existing User (Patient or Doctor)
        # Check if Admin (Hardcoded for now based on plans, or just role check)
        return jsonify({"status": "success", "user": user})
    else:
        # New Patient Registration
        if 'name' not in data or 'age' not in data:
             return jsonify({"error": "Name and Age required for new registration"}), 400

        name = data['name']
        age = data['age']
        
        # Insert new user
        cursor = execute_query(
            'INSERT INTO users (name, age, mobile, role, department, status, queue_current, queue_total) VALUES (?, ?, ?, ?, NULL, NULL, 0, 0)', 
            (name, age, mobile, 'patient'),
            commit=True
        )
        
        # Get ID of inserted user
        # Postgres uses RETURNING, SQLite uses last_insert_rowid()
        # My execute_query doesn't return ID easily for both.
        # Let's simple query back.
        user_new = execute_query('SELECT * FROM users WHERE mobile = ?', (mobile,), fetchone=True)
        
        return jsonify({"status": "success", "user": user_new})

# --- PUBLIC APIS ---

@app.route('/api/doctors', methods=['GET'])
def get_doctors():
    # Added mobile to query so frontend can use it for login ID
    doctors = execute_query('SELECT id, name, mobile, department, status, queue_current, queue_total, room_number, description FROM users WHERE role = ?', ('doctor',), fetchall=True)
    return jsonify(doctors)

@app.route('/api/appointments', methods=['GET'])
def get_appointments():
    mobile = request.args.get('mobile')
    if not mobile:
        return jsonify([])
    
    # Join with reports to get follow_up_date
    query = '''
        SELECT a.*, r.follow_up_date 
        FROM appointments a
        LEFT JOIN reports r ON a.report_id = 'generated' AND a.id = r.appointment_id
        WHERE a.user_mobile = ? 
        ORDER BY a.id DESC
    '''
    appointments = execute_query(query, (mobile,), fetchall=True)
    
    return jsonify(appointments)

@app.route('/api/book', methods=['POST'])
def book_appointment():
    data = request.json
    
    execute_query(
        'INSERT INTO appointments (dept, date, status, user_mobile, report_id, patient_name, patient_age) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (data['dept'], data['date'], 'Scheduled', data['mobile'], None, data.get('patient_name'), data.get('patient_age')),
        commit=True
    )
    
    # We need the ID for UI? The frontend might not use it immediately, but let's try to get it.
    # For now, return status success is enough as per old code logic (old code returned new_id, but frontend might ignore it).
    # To be safe, let's select max id for this user.
    last_apt = execute_query('SELECT id FROM appointments WHERE user_mobile = ? ORDER BY id DESC LIMIT 1', (data['mobile'],), fetchone=True)
    new_id = last_apt['id'] if last_apt else 0
    
    return jsonify({"status": "success", "id": new_id})

# --- DOCTOR API ---

@app.route('/api/admin/appointments') # Legacy or alternative path
def get_all_appointments_legacy():
    return get_all_appointments_admin()

@app.route('/api/admin/all_appointments')
def get_all_appointments_admin():
    query = '''
        SELECT 
            a.id, 
            a.date, 
            a.status, 
            a.dept,
            u.name as patient_name,
            u.mobile as patient_mobile,
            d.name as doctor_name
        FROM appointments a
        LEFT JOIN users u ON a.user_mobile = u.mobile
        LEFT JOIN users d ON a.doctor_name = d.name 
        ORDER BY a.date DESC
    '''
    # Note: joining on name for doctor might be fragile if names aren't unique, 
    # but based on schema, doctor_name is stored in appointments.
    
    results = execute_query(query, fetchall=True)
    return jsonify([dict(row) for row in results])

@app.route('/api/doctor/appointments', methods=['GET'])
def get_all_appointments():
    # Join with users to get patient names
    query = '''
        SELECT a.*, u.name as patient_name, u.age as patient_age, u.mobile as patient_mobile
        FROM appointments a
        LEFT JOIN users u ON a.user_mobile = u.mobile
        ORDER BY a.date DESC, a.id DESC
    '''
    appointments = execute_query(query, fetchall=True)
    return jsonify(appointments)

@app.route('/api/doctor/patient_history/<mobile>', methods=['GET'])
def get_patient_history(mobile):
    # Fetch all appointments for this mobile that are completed
    query = '''
        SELECT a.*, r.diagnosis, r.medicines, r.symptoms, r.follow_up_date 
        FROM appointments a
        LEFT JOIN reports r ON a.report_id = 'generated' AND a.id = r.appointment_id
        WHERE a.user_mobile = ?
        ORDER BY a.date DESC
    '''
    history = execute_query(query, (mobile,), fetchall=True)
    return jsonify(history)

@app.route('/api/doctor/report', methods=['POST'])
def save_report():
    # Handle both JSON and FormData (including urlencoded)
    if 'multipart/form-data' in request.content_type or 'application/x-www-form-urlencoded' in request.content_type:
        data = request.form
        file = request.files.get('file')
    else:
        # Assume JSON or try to parse it
        data = request.get_json(silent=True) or {}
        file = None

    apt_id = data['appointment_id']
    file_path = None

    if file:
        filename = secure_filename(file.filename)
        file.save(os.path.join(UPLOAD_FOLDER, filename))
        file_path = filename
    
    # Check if report exists
    existing = execute_query('SELECT id FROM reports WHERE appointment_id = ?', (apt_id,), fetchone=True)
    
    if existing:
        if file_path:
            execute_query(
                'UPDATE reports SET diagnosis = ?, medicines = ?, notes = ?, file_path = ? WHERE appointment_id = ?',
                (data['diagnosis'], data['medicines'], data['notes'], file_path, apt_id),
                commit=True
            )
        else:
            execute_query(
                'UPDATE reports SET diagnosis = ?, medicines = ?, notes = ?, symptoms = ?, follow_up_date = ? WHERE appointment_id = ?',
                (data['diagnosis'], data['medicines'], data['notes'], data.get('symptoms'), data.get('follow_up_date'), apt_id),
                commit=True
            )
    else:
        execute_query(
            'INSERT INTO reports (appointment_id, diagnosis, medicines, notes, file_path, symptoms, follow_up_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (apt_id, data['diagnosis'], data['medicines'], data['notes'], file_path, data.get('symptoms'), data.get('follow_up_date')),
            commit=True
        )
        
        # Update Appointment status
        execute_query(
            "UPDATE appointments SET status = 'Completed', report_id = ? WHERE id = ?", 
            ('generated', apt_id),
            commit=True
        )

    return jsonify({"status": "success"})

@app.route('/api/report/<int:apt_id>', methods=['GET'])
def get_report(apt_id):
    report = execute_query('SELECT * FROM reports WHERE appointment_id = ?', (apt_id,), fetchone=True)
    
    if report:
        return jsonify(report)
    else:
        return jsonify({"error": "Report not found"}), 404

@app.route('/api/appointments/<int:apt_id>', methods=['DELETE'])
def delete_appointment(apt_id):
    execute_query('DELETE FROM appointments WHERE id = ?', (apt_id,), commit=True)
    return jsonify({"status": "deleted"})

@app.route('/api/appointments/<int:apt_id>/confirm', methods=['POST'])
def confirm_appointment(apt_id):
    execute_query("UPDATE appointments SET status = 'Confirmed' WHERE id = ?", (apt_id,), commit=True)
    return jsonify({"status": "success"})

@app.route('/api/appointments/<int:apt_id>/cancel', methods=['POST'])
def cancel_appointment(apt_id):
    execute_query("UPDATE appointments SET status = 'Cancelled' WHERE id = ?", (apt_id,), commit=True)
    return jsonify({"status": "success"})

@app.route('/api/queue', methods=['GET'])
def get_queue_status():
    # Aggregate data from all doctors
    result = execute_query('SELECT SUM(queue_current) as current, SUM(queue_total) as total FROM users WHERE role = ?', ('doctor',), fetchone=True)
    
    # Check result type since SUM can return distinct types or None
    current = result['current'] if result and result.get('current') else 0
    total = result['total'] if result and result.get('total') else 0
    
    # Simple logic regarding wait time (e.g., 5 mins per patient in queue)
    # This is just a global average estimatation
    active_queue = total - current
    active_queue = active_queue if active_queue > 0 else 0
    wait_time = active_queue * 15 # default 15 mins per patient
    
    return jsonify({
        "current": int(current),
        "total": int(total),
        "waitTime": int(wait_time)
    })

# --- DOCTOR APIS ---

@app.route('/api/doctor/status', methods=['POST'])
def update_doctor_status():
    data = request.json
    doc_id = data.get('id')
    
    if 'status' in data:
        execute_query('UPDATE users SET status = ? WHERE id = ?', (data['status'], doc_id), commit=True)
    
    if 'queue_current' in data:
        execute_query('UPDATE users SET queue_current = ? WHERE id = ?', (data['queue_current'], doc_id), commit=True)
        
    if 'queue_total' in data:
        execute_query('UPDATE users SET queue_total = ? WHERE id = ?', (data['queue_total'], doc_id), commit=True)
        
    return jsonify({"message": "Status Updated"})


@app.route('/api/contact', methods=['POST'])
def save_contact_message():
    data = request.json
    execute_query(
        'INSERT INTO messages (name, subject, message) VALUES (?, ?, ?)',
        (data.get('name', 'Anonymous'), data['subject'], data['message']),
        commit=True
    )
    return jsonify({"status": "success"})


@app.route('/api/doctor/messages', methods=['GET'])
def get_messages():
    msgs = execute_query('SELECT * FROM messages ORDER BY created_at DESC', fetchall=True)
    return jsonify(msgs)

# --- ADMIN API ---

@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    # 1. Counts
    doc_count = execute_query('SELECT count(*) as count FROM users WHERE role = ?', ('doctor',), fetchone=True)['count']
    patient_count = execute_query('SELECT count(*) as count FROM users WHERE role = ?', ('patient',), fetchone=True)['count']
    appt_count = execute_query('SELECT count(*) as count FROM appointments', fetchone=True)['count']
    
    # 2. Revenue (Mock logic: Assuming $50 per completed appointment)
    completed_appts = execute_query("SELECT count(*) as count FROM appointments WHERE status = 'Completed'", fetchone=True)['count']
    revenue = completed_appts * 50
    
    # 3. Recent Activity (Last 5 appointments)
    recent = execute_query("SELECT a.id, a.date, a.status, u.name as patient_name FROM appointments a LEFT JOIN users u ON a.user_mobile = u.mobile ORDER BY a.id DESC LIMIT 5", fetchall=True)

    return jsonify({
        "doctors": doc_count,
        "patients": patient_count,
        "appointments": appt_count,
        "revenue": revenue,
        "recent_activity": recent
    })

@app.route('/api/admin/doctors', methods=['GET', 'POST', 'DELETE'])
def manage_doctors():
    if request.method == 'GET':
        doctors = execute_query('SELECT * FROM users WHERE role = ?', ('doctor',), fetchall=True)
        return jsonify(doctors)
    
    if request.method == 'DELETE':
        doc_id = request.args.get('id')
        execute_query('DELETE FROM users WHERE id = ? AND role = ?', (doc_id, 'doctor'), commit=True)
        return jsonify({"status": "deleted"})
        
    if request.method == 'POST':
        data = request.json
        # Add new doctor
        # Simple password generation (mobile as password for now)
        try:
            execute_query(
                "INSERT INTO users (name, age, mobile, role, department, status, queue_current, queue_total, room_number, description) VALUES (?, ?, ?, 'doctor', ?, 'Available', 0, 0, ?, ?)",
                (data['name'], 45, data['mobile'], data['department'], data['room'], data['description']),
                commit=True
            )
            return jsonify({"status": "success"})
        except Exception as e:
            return jsonify({"error": str(e)}), 400

@app.route('/api/admin/patients', methods=['GET', 'DELETE'])
def manage_patients():
    if request.method == 'GET':
        patients = execute_query('SELECT * FROM users WHERE role = ?', ('patient',), fetchall=True)
        return jsonify(patients)

    if request.method == 'DELETE':
        patient_id = request.args.get('id')
        execute_query('DELETE FROM users WHERE id = ? AND role = ?', (patient_id, 'patient'), commit=True)
        return jsonify({"status": "deleted"})

@app.route('/api/admin/all_appointments', methods=['GET'])
def get_admin_appointments():
    # Fetch all appointments with details
    query = '''
        SELECT a.*, u.name as patient_name, u.age as patient_age, u.mobile as patient_mobile
        FROM appointments a
        LEFT JOIN users u ON a.user_mobile = u.mobile
        ORDER BY a.date DESC, a.id DESC
    '''
    appointments = execute_query(query, fetchall=True)
    return jsonify(appointments)

# Run DB Init on Import (for Gunicorn/Render)
init_db_if_needed()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
