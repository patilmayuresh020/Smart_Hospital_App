import requests
import json
import time

BASE_URL = "http://127.0.0.1:5000/api"

def run_tests():
    print("Starting Backend Verification...")
    
    # 1. Test Contact Us
    print("\n[Test 1] Contact Us API")
    msg_data = {
        "name": "Test Bot",
        "subject": "System Check",
        "message": "Verifying message persistence."
    }
    res = requests.post(f"{BASE_URL}/contact", json=msg_data)
    if res.status_code == 200 and res.json()['status'] == 'success':
        print("  - Message Sent: OK")
    else:
        print(f"  - Message Sending Failed: {res.text}")
        return

    # Verify Doctor receives it
    res = requests.get(f"{BASE_URL}/doctor/messages")
    messages = res.json()
    found = any(m['message'] == "Verifying message persistence." for m in messages)
    if found:
        print("  - Doctor Retrieval: OK")
    else:
        print("  - Doctor Retrieval: FAIL (Message not found)")

    # 2. Test Appointment & Cancel
    print("\n[Test 2] Appointment Booking & Cancellation")
    book_data = {
        "dept": "General Physician",
        "date": "2023-12-31",
        "mobile": "9876543210" # Demo User
    }
    res = requests.post(f"{BASE_URL}/book", json=book_data)
    apt_id = res.json()['id']
    print(f"  - Booked Apt ID: {apt_id}")

    # Cancel it
    res = requests.post(f"{BASE_URL}/appointments/{apt_id}/cancel")
    if res.status_code == 200:
        print("  - Cancel Request: OK")
    
    # Verify Status
    res = requests.get(f"{BASE_URL}/appointments?mobile=9876543210")
    apts = res.json()
    my_apt = next((a for a in apts if a['id'] == apt_id), None)
    if my_apt and my_apt['status'] == 'Cancelled':
        print("  - Status Verification: OK (Cancelled)")
    else:
        print(f"  - Status Verification: FAIL (Status is {my_apt['status'] if my_apt else 'None'})")

    # 3. Test Prescription with Symptoms & Follow-up
    print("\n[Test 3] Prescription with Symptoms & Follow-up")
    # Book new one for report
    res = requests.post(f"{BASE_URL}/book", json=book_data)
    apt_id = res.json()['id']
    print(f"  - Booked Apt ID for Report: {apt_id}")

    report_data = {
        "appointment_id": apt_id,
        "diagnosis": "Test Diagnosis",
        "medicines": "Test Meds",
        "notes": "Test Notes",
        "symptoms": "High Fever, Shivering",
        "follow_up_date": "2024-01-01"
    }
    res = requests.post(f"{BASE_URL}/doctor/report", json=report_data)
    if res.status_code == 200:
         print("  - Report Saved: OK")
    else:
         print(f"  - Report Save Failed: {res.text}")

    # Verify Report Content
    res = requests.get(f"{BASE_URL}/report/{apt_id}")
    report = res.json()
    
    if report.get('symptoms') == "High Fever, Shivering":
        print("  - Symptoms Field: OK")
    else:
        print(f"  - Symptoms Field: FAIL (Got {report.get('symptoms')})")

    if report.get('follow_up_date') == "2024-01-01":
        print("  - Follow-up Date: OK")
        print("  - Book Follow-up Button should appear in UI.")
    else:
        print(f"  - Follow-up Date: FAIL (Got {report.get('follow_up_date')})")

    print("\nBackend Verification Completed.")

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"Test Execution Failed: {e}")
