// --- CONFIGURATION ---
const API_BASE = '/api';

// --- AUTH GUARD & LOGIN ---
const adminSession = localStorage.getItem('admin_session');

// Check session on load
if (adminSession === 'true') {
    document.body.classList.remove('not-logged-in');
    const overlay = document.getElementById('admin-login-overlay');
    if (overlay) overlay.style.display = 'none';
} else {
    document.body.classList.add('not-logged-in');
    const overlay = document.getElementById('admin-login-overlay');
    if (overlay) overlay.style.display = 'flex';
}

// Handle Login (Global Scope)
window.handleAdminLogin = function (e) {
    e.preventDefault();
    const user = document.getElementById('admin-username').value.trim();
    const pass = document.getElementById('admin-password').value.trim();

    if (user === 'Mayuresh' && pass === '123456789') {
        localStorage.setItem('admin_session', 'true');

        Swal.fire({
            title: 'Welcome Back, Sir',
            text: 'Access Granted',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false,
            background: '#1e3c72',
            color: '#fff',
            iconColor: '#00ff00'
        }).then(() => {
            document.body.classList.remove('not-logged-in');
            const overlay = document.getElementById('admin-login-overlay');
            if (overlay) overlay.style.display = 'none';
            // Force reload to clean up any state if needed, or just stay
            // window.location.reload(); 
        });
    } else {
        Swal.fire({
            title: 'Access Denied',
            text: 'Invalid Credentials',
            icon: 'error',
            background: '#1e3c72',
            color: '#fff'
        });
    }
};

// Logout Logic
const logoutBtn = document.querySelector('.logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        Swal.fire({
            title: 'Logging Out',
            text: 'See you soon.',
            icon: 'info',
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            localStorage.removeItem('admin_session');
            window.location.reload();
        });
    });
}

// ... (Existing Sidebar/Toggle Code) ...

// SECTION SWITCHING
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.style.display = 'none';
        sec.classList.remove('active');
    });

    // Show target section
    const target = document.getElementById(sectionId + '-section');
    if (target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);

        // Load data if needed
        if (sectionId === 'doctors') loadDoctors();
        if (sectionId === 'patients') loadPatients();
        if (sectionId === 'appointments') loadAppointments();
    }
}

// ... (Existing Dashboard/Chart Code) ...

// --- APPOINTMENTS MANAGEMENT (Day-wise) ---
async function loadAppointments() {
    try {
        const container = document.getElementById('appointments-container');
        container.innerHTML = '<p>Loading appointments...</p>';

        const response = await fetch(`${API_BASE}/admin/all_appointments`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const appointments = await response.json();
        // console.log('Appointments fetched:', appointments);

        if (appointments.length === 0) {
            container.innerHTML = '<p>No appointments found.</p>';
            return;
        }

        container.innerHTML = '';

        let rowsHtml = '';
        appointments.forEach(apt => {
            rowsHtml += `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">#${apt.id}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    <span style="font-weight: 500;">${apt.patient_name || 'Unknown'}</span>
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${apt.patient_mobile || '--'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${apt.date}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${apt.dept}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    <span class="status ${(apt.status || 'pending').toLowerCase()}">${apt.status || 'Pending'}</span>
                </td>
            </tr>
            `;
        });
        console.log('Rows generated, updating DOM...');

        const tableHtml = `
            <table class="day-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f1f1f1; text-align: left;">
                        <th style="padding: 10px; color: #555;">ID</th>
                        <th style="padding: 10px; color: #555;">Patient</th>
                        <th style="padding: 10px; color: #555;">Mobile</th>
                        <th style="padding: 10px; color: #555;">Date</th>
                        <th style="padding: 10px; color: #555;">Department</th>
                        <th style="padding: 10px; color: #555;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHtml;

    } catch (e) {
        console.error("Error loading appointments:", e);
        // alert("Error loading appointments: " + e.message); // Visible error for debugging
        document.getElementById('appointments-container').innerHTML = '<p style="color:red; list-style:none;">Error loading data. Check console.</p>';
    }
}

// ... (Existing Doctor/Patient Management Code) ...

// Sidebar Toggle
const allSideMenu = document.querySelectorAll('#sidebar .side-menu.top li a');

allSideMenu.forEach(item => {
    const li = item.parentElement;

    item.addEventListener('click', function () {
        allSideMenu.forEach(i => {
            i.parentElement.classList.remove('active');
        })
        li.classList.add('active');
    })
});

// TOGGLE SIDEBAR
const menuBar = document.querySelector('#content nav .bx.bx-menu');
const sidebar = document.getElementById('sidebar');

menuBar.addEventListener('click', function () {
    sidebar.classList.toggle('hide');
})

// SECTION SWITCHING
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.style.display = 'none';
        sec.classList.remove('active');
    });

    // Show target section
    const target = document.getElementById(sectionId + '-section');
    if (target) {
        target.style.display = 'block';
        // Force reflow to enable transition if needed, but for now instant is better to avoid blink
        // void target.offsetWidth; 
        target.classList.add('active');

        // Load data if needed
        if (sectionId === 'doctors') loadDoctors();
        if (sectionId === 'patients') loadPatients();
        if (sectionId === 'appointments') loadAppointments();
    }
}

// FETCH DASHBOARD DATA
async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/admin/stats`);
        const data = await response.json();

        // Update Counters
        animateValue("cnt-doctors", 0, data.doctors, 1000);
        animateValue("cnt-patients", 0, data.patients, 1000);
        animateValue("cnt-appts", 0, data.appointments, 1000);
        // Revenue removed

        // Update Recent Activity Table
        const tbody = document.getElementById('recent-appts-body');
        tbody.innerHTML = '';
        data.recent_activity.forEach(appt => {
            const row = `
                <tr>
                    <td>
                        <img src="https://ui-avatars.com/api/?name=${appt.patient_name}&background=random">
                        <p>${appt.patient_name || 'Unknown'}</p>
                    </td>
                    <td>${appt.date}</td>
                    <td><span class="status ${appt.status.toLowerCase()}">${appt.status}</span></td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// ANIMATE NUMBERS
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// --- DOCTOR MANAGEMENT ---

async function loadDoctors() {
    try {
        const response = await fetch(`${API_BASE}/admin/doctors`);
        const doctors = await response.json();
        const tbody = document.getElementById('doctors-list-body');
        tbody.innerHTML = '';

        doctors.forEach(doc => {
            const row = `
                <tr>
                    <td>
                        <img src="https://ui-avatars.com/api/?name=${doc.name}&background=random">
                        <p>${doc.name}</p>
                    </td>
                    <td>${doc.department}</td>
                    <td>${doc.room_number || 'N/A'}</td>
                    <td><span class="status completed">Active</span></td>
                    <td>
                        <button class="btn-delete" onclick="deleteDoctor('${doc.id}')"><i class='bx bx-trash'></i></button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (e) {
        console.error(e);
    }
}

async function deleteDoctor(id) {
    if (!confirm("Are you sure you want to delete this doctor?")) return;

    await fetch(`${API_BASE}/admin/doctors?id=${id}`, { method: 'DELETE' });
    loadDoctors();
    loadDashboard(); // Update stats
}


async function openAddDoctorModal() {
    const { value: formValues } = await Swal.fire({
        title: 'Add New Doctor',
        html:
            '<input id="swal-name" class="swal2-input" placeholder="Full Name">' +
            '<input id="swal-mobile" class="swal2-input" placeholder="Mobile (Login ID)">' +
            '<input id="swal-dept" class="swal2-input" placeholder="Department">' +
            '<input id="swal-room" class="swal2-input" placeholder="Room Number">' +
            '<input id="swal-desc" class="swal2-input" placeholder="Description">',
        focusConfirm: false,
        preConfirm: () => {
            return {
                name: document.getElementById('swal-name').value,
                mobile: document.getElementById('swal-mobile').value,
                department: document.getElementById('swal-dept').value,
                room: document.getElementById('swal-room').value,
                description: document.getElementById('swal-desc').value
            }
        }
    })

    if (formValues) {
        const res = await fetch(`${API_BASE}/admin/doctors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formValues)
        });

        if (res.ok) {
            Swal.fire('Success', 'Doctor added successfully', 'success');
            loadDoctors();
            loadDashboard();
        } else {
            Swal.fire('Error', 'Failed to add doctor', 'error');
        }
    }
}

// --- PATIENT MANAGEMENT ---
async function loadPatients() {
    try {
        const response = await fetch(`${API_BASE}/admin/patients`);
        const patients = await response.json();
        const tbody = document.getElementById('patients-list-body');
        tbody.innerHTML = '';

        patients.forEach(p => {
            const row = `
                <tr>
                    <td>${p.id}</td>
                    <td>
                        <p>${p.name}</p>
                    </td>
                    <td>${p.age}</td>
                    <td>${p.mobile}</td>
                    <td>${new Date(p.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn-delete" style="color: red; cursor: pointer; border: none; background: none; font-size: 1.2rem;" onclick="deletePatient('${p.id}')" title="Remove Patient">
                            <i class='bx bx-trash'></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (e) { console.error(e); }
}

async function deletePatient(id) {
    if (!confirm("Are you sure you want to remove this patient? This action cannot be undone.")) return;

    try {
        const res = await fetch(`${API_BASE}/admin/patients?id=${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.status === 'deleted') {
            // Swal.fire('Deleted!', 'Patient has been removed.', 'success');
            loadPatients(); // Refresh list
            loadDashboard(); // Update stats
        } else {
            alert("Failed to delete patient");
        }
    } catch (e) {
        console.error("Error deleting patient:", e);
        alert("Error occurred while deleting patient");
    }
}


// INITIALIZATION & AUTO-REFRESH
document.addEventListener("DOMContentLoaded", () => {
    // 1. Force Dashboard Display
    showSection('dashboard');
    loadDashboard();

    // 2. Setup Auto-Refresh (Every 10s)
    setInterval(() => {
        loadDashboard();
        // Refresh active section
        const activeSection = document.querySelector('.admin-section.active');
        if (activeSection) {
            const secId = activeSection.id;
            if (secId === 'doctors-section') loadDoctors();
            if (secId === 'patients-section') loadPatients();
            if (secId === 'appointments-section') loadAppointments();
        }
    }, 10000);

    // 3. Lazy Load Listeners
    document.querySelectorAll('.side-menu li a').forEach(link => {
        link.addEventListener('click', (e) => {
            const section = e.target.innerText.trim();
            if (section === 'Doctors') loadDoctors();
            if (section === 'Patients') loadPatients();
            if (section === 'Appointments') loadAppointments();
        })
    });

    // 4. Temporarily Disabled Auth Logic would go here
});
