import requests
import sqlite3
import os

# 1. Check API
try:
    print("Checking API: http://127.0.0.1:5000/api/admin/all_appointments")
    r = requests.get('http://127.0.0.1:5000/api/admin/all_appointments')
    if r.status_code == 200:
        data = r.json()
        print(f"API Response ({len(data)} items):")
        print(data)
    else:
        print(f"API Error: {r.status_code} - {r.text}")
except Exception as e:
    print(f"API Connection Failed: {e}")

# 2. Check DB directly
print("\nChecking DB 'appointments' table:")
try:
    conn = sqlite3.connect('C:/Users/patil/Desktop/Smart_Hospital_App/backend/hospital.db')
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM appointments")
    rows = cursor.fetchall()
    print(f"DB Rows ({len(rows)}):")
    for row in rows:
        print(row)
    conn.close()
except Exception as e:
    print(f"DB Error: {e}")
