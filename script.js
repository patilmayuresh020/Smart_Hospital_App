// State Management
const API_URL = '/api'; // Relative path (Same Origin)

const appState = {
    user: null, // { name, age, mobile }
    currentScreen: 'login-screen',
    appointments: [],
    queue: {
        current: 0,
        total: 0,
        waitTime: 0
    },
    theme: localStorage.getItem('theme') || 'light'
};

// Data: Departments
// Data: Departments (Icons only)
const departments = [
    { id: 'gen', name: 'General Physician', icon: '🩺' },
    { id: 'den', name: 'Dental', icon: '🦷' },
    { id: 'ent', name: 'ENT', icon: '👂' },
    { id: 'orth', name: 'Orthopedic', icon: '🦴' },
    { id: 'card', name: 'Cardiology', icon: '❤️' },
    { id: 'ped', name: 'Pediatrics', icon: '👶' }
];

// Data: Mock Reports
const mockReports = {
    'R-101': {
        id: 'R-101',
        date: '2023-10-15',
        doc: 'Dr. Sharma',
        diagnosis: 'Viral Fever & Dehydration',
        vitals: 'BP: 120/80 | Temp: 101°F | SpO2: 98%',
        meds: ['Paracetamol 650mg (3 days)', 'ORS Solution'],
        followUp: 5 // days
    }
};

// DOM Elements
const screens = {
    login: document.getElementById('login-screen'),
    dashboard: document.getElementById('dashboard-screen'),
    booking: document.getElementById('booking-screen'),
    doctor: document.getElementById('doctor-screen')
};

const profilePanel = {
    overlay: document.getElementById('profile-overlay'),
    reportModal: document.getElementById('report-modal')
};

const forms = {
    login: document.getElementById('login-form'),
    report: document.getElementById('report-form')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    initNavigation();
    initTheme();

    // ACTION: Check for Persistent Login
    const saved = localStorage.getItem('patient_user');
    if (saved) {
        try {
            appState.user = JSON.parse(saved);
            console.log("Auto-login success:", appState.user);
            updateUserProfileUI();
            navigateTo('dashboard');
            renderDashboardContent('home');
            document.querySelector('.nav-btn[data-target="home"]').classList.add('active');
        } catch (e) {
            console.error("Session invalid:", e);
            localStorage.removeItem('patient_user');
        }
    }

    // Start Live Queue Simulation
    setInterval(() => {
        if (Math.random() > 0.7) {
            appState.queue.current++;
            appState.queue.total += Math.floor(Math.random() * 2);
            updateQueueUI();
        }
    }, 5000);
});

// --- CORE FUNCTIONS ---

// 1. Navigation Controller (Strict Screen Switching)
function navigateTo(screenId) {
    // Hide all screens
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active-screen');
    });

    // Show target screen
    if (screens[screenId]) {
        screens[screenId].classList.add('active-screen');
        appState.currentScreen = screenId + '-screen';

        // If entering dashboard, default to home if not specific
        if (screenId === 'dashboard') {
            // Keep current view if already set, else home
            if (!document.getElementById('main-view-container').hasChildNodes()) {
                renderDashboardContent('home');
                document.querySelector('.nav-btn[data-target="home"]').classList.add('active');
            }
        }
    }
}

// 2. Login Logic
function initLogin() {
    forms.login.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log("Login submit clicked");

        const name = document.getElementById('patient-name').value.trim();
        const age = document.getElementById('patient-age').value;
        const mobile = document.getElementById('patient-mobile').value;
        const errorDiv = document.getElementById('login-error');

        // Validation
        if (name.length < 2) {
            alert("Name is too short!");
            errorDiv.textContent = "Please enter a valid name.";
            return;
        }

        // Allow 'admin' for doctor login
        if (mobile !== 'admin' && !/^\d{10}$/.test(mobile)) {
            alert("Invalid Mobile: Must be 10 digits");
            errorDiv.textContent = "Please enter a valid 10-digit mobile number.";
            return;
        }

        console.log("Sending Login Request:", { name, age, mobile });

        // API CALL: Login
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, age, mobile })
        })
            .then(res => res.json())
            .then(data => {
                console.log("Login Response:", data);
                if (data.status === 'success') {
                    appState.user = data.user;
                    localStorage.setItem('patient_user', JSON.stringify(data.user)); // SAVE SESSION
                    errorDiv.textContent = "";

                    showToast(`Welcome back, ${appState.user.name}!`, 'success');

                    updateUserProfileUI();
                    navigateTo('dashboard');
                } else {
                    alert("Login Failed: " + (data.error || "Unknown Error"));
                    errorDiv.textContent = "Login failed. Please try again.";
                }
            })
            .catch(err => {
                alert("Server Error: " + err.message);
                showToast("Backend Server Error. Ensure server.py is running!", 'error');
            });
    });
}

// 3. Navigation & Actions
function initNavigation() {
    // Nav Buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.closest('button').dataset.target;
            if (target) {
                handleDashboardNav(target);
            }
        });
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        appState.user = null;
        appState.appointments = [];
        localStorage.removeItem('patient_user'); // CLEAR SESSION
        forms.login.reset();
        navigateTo('login');
    });



    // Report Modal
    document.getElementById('close-report-btn')?.addEventListener('click', () => {
        profilePanel.reportModal.classList.add('hidden');
    });

    forms.report?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveReport();
    });

    // Profile Panel
    document.getElementById('profile-trigger').addEventListener('click', () => {
        profilePanel.overlay.classList.remove('hidden');
    });

    document.getElementById('close-profile-btn').addEventListener('click', () => {
        profilePanel.overlay.classList.add('hidden');
    });

    profilePanel.overlay.addEventListener('click', (e) => {
        if (e.target === profilePanel.overlay) {
            profilePanel.overlay.classList.add('hidden');
        }
    });

    // Booking Flow
    const bookingBackBtn = document.getElementById('booking-back-btn');
    if (bookingBackBtn) {
        bookingBackBtn.addEventListener('click', () => {
            navigateTo('dashboard');
        });
    }

    const bookingDeptSelect = document.getElementById('booking-dept');
    bookingDeptSelect.addEventListener('change', (e) => {
        checkBookingAvailability(e.target.value);
    });

    document.getElementById('confirm-booking-btn').addEventListener('click', confirmBooking);

    // NEW: Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
}

// 4. Update UI with User Data
function updateUserProfileUI() {
    if (!appState.user) return;

    // Initials
    const names = appState.user.name.split(' ');
    const initials = (names[0][0] + (names.length > 1 ? names[names.length - 1][0] : '')).toUpperCase();

    document.getElementById('user-initials').textContent = initials;
    document.getElementById('panel-initials').textContent = initials;

    document.getElementById('panel-name').textContent = appState.user.name;
    document.getElementById('panel-details').textContent = `Age: ${appState.user.age} | Mobile: ${appState.user.mobile}`;

    // Pre-fill Booking Form
    document.getElementById('booking-name').textContent = appState.user.name;
    document.getElementById('booking-age').textContent = appState.user.age;
    document.getElementById('booking-mobile').textContent = appState.user.mobile;

    renderAppointmentList();
}

// 5. Dashboard View Switching
function handleDashboardNav(target) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-target="${target}"]`)?.classList.add('active');

    if (target === 'appointments') {
        renderDashboardContent('appointments');
    } else {
        renderDashboardContent(target);
    }
}

function renderDashboardContent(view) {
    const container = document.getElementById('main-view-container');
    container.innerHTML = '';

    // Hero Visibility
    const hero = document.querySelector('.hero-section');
    if (hero) hero.classList.toggle('hidden', view !== 'home');

    if (view === 'home' || view === 'departments') {
        const title = document.createElement('h3');
        title.textContent = 'Available Doctors';
        title.style.marginBottom = '15px';
        container.appendChild(title);

        const searchDiv = document.createElement('div');
        searchDiv.style.marginBottom = '25px';
        searchDiv.innerHTML = `
            <input type="text" id="doctor-search" placeholder="🔍 Search doctors by name or department..." 
            style="width:100%; padding:12px; border:1px solid #ccc; border-radius:8px; font-size:1rem;">
        `;
        container.appendChild(searchDiv);

        // Add Event Listener
        const searchInput = searchDiv.querySelector('input');
        searchInput.addEventListener('input', (e) => filterDoctors(e.target.value));

        const loading = document.createElement('div');
        loading.textContent = 'Loading doctors...';
        container.appendChild(loading);

        fetch('/api/doctors')
            .then(res => res.json())
            .then(doctors => {
                loading.remove();
                if (doctors.length === 0) {
                    container.innerHTML += '<p>No doctors found.</p>';
                    return;
                }

                // Filter duplicates by name just in case
                const uniqueDocs = Array.from(new Map(doctors.map(item => [item.name, item])).values());

                // Store uniqueDocs globally for filtering
                window.allDoctors = uniqueDocs;
                renderDoctorGrid(uniqueDocs, container);
            })
            .catch(err => {
                console.error(err);
                container.innerHTML += '<p class="text-red">Error loading doctors.</p>';
            });
    }
    else if (view === 'queue') {
        container.innerHTML = `
            <h3>Live Queue Status</h3>
            <div class="queue-box">
                <p>Currently Serving Appointment No:</p>
                <div class="big-number" id="live-queue-num">${appState.queue.current}</div>
                <div class="queue-stats">
                    <div class="stat-item">
                        <h4 id="live-total">${appState.queue.total}</h4>
                        <span>Total Today</span>
                    </div>
                    <div class="stat-item">
                        <h4>~${appState.queue.waitTime} min</h4>
                        <span>Avg Wait Time</span>
                    </div>
                </div>
                <div class="mt-4 text-green" style="font-weight:500;">
                    <span class="status-dot available"></span> Live Updates Active
                </div>
            </div>
         `;
        // Trigger fetch
        fetchQueueUpdate();
    }
    else if (view === 'contact') {
        container.innerHTML = `
            <h3>Contact Us</h3>
            <div class="contact-container">
                <div class="contact-info">
                    <h4>Get in Touch</h4>
                    <p style="margin-bottom:25px; color:#666; line-height:1.5;">Have questions or need assistance? Our support team is here to help you 24/7.</p>
                    
                    <div class="contact-item">
                        <div class="contact-icon">📍</div>
                        <div class="contact-text">
                            <h5>Address</h5>
                            <p>123 Health Valley, Wellness City,<br>Jalgaon, Maharashtra 425001</p>
                        </div>
                    </div>

                    <div class="contact-item">
                        <div class="contact-icon">📞</div>
                        <div class="contact-text">
                            <h5>Emergency Support</h5>
                            <p>+91 98765 43210</p>
                            <p>022 - 1234 5678</p>
                        </div>
                    </div>

                    <div class="contact-item">
                        <div class="contact-icon">✉</div>
                        <div class="contact-text">
                            <h5>Email</h5>
                            <p>helpdesk@patilhospital.com</p>
                        </div>
                    </div>
                </div>

                <div class="contact-form">
                    <h4>Send us a Message</h4>
                    <form onsubmit="handleContactSubmit(event)">
                        <div class="form-group">
                            <label>Full Name</label>
                            <input type="text" required placeholder="Your Name" value="${appState.user ? appState.user.name : ''}">
                        </div>
                        <div class="form-group">
                            <label>Subject</label>
                            <select class="form-select" required style="margin-top:0;">
                                <option>General Inquiry</option>
                                <option>Appointment Issue</option>
                                <option>Feedback</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Message</label>
                            <textarea rows="4" required placeholder="How can we help you?"></textarea>
                        </div>
                        <button type="submit" class="btn-primary">Send Message</button>
                    </form>
                </div>
            </div>
        `;
    }

    else if (view === 'appointments') {
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3>Your Appointments</h3>
                <button class="btn-primary" style="width:auto;" onclick="window.startBooking()">+ Book New</button>
            </div>
            <div id="full-apt-list">Loading appointments...</div>
        `;

        const listDiv = document.getElementById('full-apt-list');

        // API CALL: Get Appointments
        fetch(`/api/appointments?mobile=${appState.user.mobile}`)
            .then(res => res.json())
            .then(data => {
                appState.appointments = data; // Sync local state

                if (data.length === 0) {
                    listDiv.innerHTML = '<p>No appointments found.</p>';
                } else {
                    listDiv.innerHTML = ''; // Clear loading
                    data.forEach(apt => {
                        const item = document.createElement('div');
                        item.className = 'dept-card';
                        item.style.marginBottom = '15px';
                        item.style.display = 'flex';
                        item.style.justifyContent = 'space-between';
                        item.style.alignItems = 'center';

                        item.innerHTML = `
                        <div>
                            <h4 style="margin-bottom:5px;">${apt.dept}</h4>
                            <div style="color:#666; font-size:0.9rem;">Date: ${apt.date} | ID: #${apt.id}</div>
                            <div style="margin-top:5px; font-weight:500; color:${apt.status === 'Completed' ? 'green' : (apt.status === 'Cancelled' ? 'red' : '#0056b3')}">${apt.status}</div>
                        </div>
                         <div>
                            ${apt.status === 'Completed' ?
                                `<button class="nav-btn" style="border:1px solid #ccc; color:#0056b3;" onclick="window.viewReport('${apt.id}')">📄 View Report</button>` :
                                ''}
                        </div>
                    `;
                        listDiv.appendChild(item);
                    });
                }
            })
            .catch(err => listDiv.innerHTML = '<p class="text-red">Failed to load appointments.</p>');
    }
    else if (view === 'report-view') {
        // Logic handled by viewReport directly, but here is a placeholder if needed
    }
}

function updateQueueUI() {
    const el = document.getElementById('live-queue-num');
    if (el) {
        el.textContent = appState.queue.current;
        document.getElementById('live-total').textContent = appState.queue.total;

        // Update Wait Time
        const waitEl = document.querySelector('.queue-stats .stat-item:last-child h4');
        if (waitEl) waitEl.textContent = `~${appState.queue.waitTime} min`;
    }
}

function fetchQueueUpdate() {
    fetch(`${API_URL}/queue`)
        .then(res => res.json())
        .then(data => {
            appState.queue = data;
            updateQueueUI();
        })
        .catch(err => console.error("Queue Fetch Error:", err));
}

// 6. Booking Logic
window.startBookingWith = function (deptName) {
    navigateTo('booking');
    const select = document.getElementById('booking-dept');
    select.value = deptName;
    checkBookingAvailability(deptName);
};

window.startBooking = function () {
    navigateTo('booking');
};

function checkBookingAvailability(deptName) {
    const msgBox = document.getElementById('doctor-availability-msg');
    const btn = document.getElementById('confirm-booking-btn');

    if (!deptName) {
        msgBox.innerHTML = '';
        msgBox.classList.add('hidden');
        btn.disabled = true;
        return;
    }

    // FIX: Find doctor from global list
    const doc = window.allDoctors ? window.allDoctors.find(d => d.department === deptName) : null;

    msgBox.classList.remove('hidden');

    if (doc && doc.status === 'unavailable') {
        msgBox.innerHTML = `<span class="text-red">⚠ We are sorry, ${doc.name} is currently unavailable. Please check back later.</span>`;
        btn.disabled = true;
    } else if (doc && doc.status === 'busy') {
        msgBox.innerHTML = `<span class="text-orange">ℹ ${doc.name} is currently in consultation. Expected wait time: 30 mins. You can still book.</span>`;
        btn.disabled = false;
    } else {
        msgBox.innerHTML = `<span class="text-green">✔ ${doc.name} is available for consultation!</span>`;
        btn.disabled = false;
    }
}

function confirmBooking() {
    const dept = document.getElementById('booking-dept').value;
    if (!dept) return;

    // API CALL: Book Appointment
    fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            dept: dept,
            date: new Date().toLocaleDateString(),
            mobile: appState.user.mobile,
            patient_name: appState.user.name,
            patient_age: appState.user.age
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                showToast(`Appointment Confirmed! ID: #${data.id}`, 'success');
                updateUserProfileUI();
                navigateTo('dashboard');
                handleDashboardNav('queue');
            }
        })
        .catch(err => showToast("Booking failed!", 'error'));
}

window.viewReport = function (reportId) {
    const container = document.getElementById('main-view-container');
    document.querySelector('.hero-section').classList.add('hidden'); // Hide hero

    container.innerHTML = '<p>Loading Report...</p>';

    fetch(`${API_URL}/report/${reportId}`) // Assuming reportId passed is actually appointment ID for now, or we need a way to map
        .then(res => {
            if (!res.ok) throw new Error("Report not found");
            return res.json();
        })
        .then(report => {
            // Fetch appointment details to get doctor name, etc if not in report
            // Also need dept for follow up booking
            return fetch(`/api/appointments`).then(res => res.json()).then(apts => {
                const apt = apts.find(a => a.id == report.appointment_id); // Find specific apt if possible, simplified here
                // Actually the report doesn't have dept info directly unless we join. 
                // Let's rely on the frontend knowing who they booked with or just pass general.
                // For now, let's just render.
                report.dept = apt ? apt.dept : '';
                renderReportView(container, report);
            });
        })
        .catch(err => {
            container.innerHTML = `<p class="text-red">⚠ Document not ready or not found. <br><small>${err.message}</small></p>
            <button onclick="handleDashboardNav('appointments')" class="nav-btn">Back</button>`;
        });
};

function renderReportView(container, report) {
    // If we need extra data like Doctor Name which isn't in 'reports' table (only apt_id),
    // we might need to fetch appointment info too. 
    // For now, let's assume the user just wants the medical content.

    container.innerHTML = `
        <div class="report-paper" style="background:white; padding:40px; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.1); max-width:800px; margin:auto;">
            <div style="border-bottom:2px solid #333; padding-bottom:20px; margin-bottom:30px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                     <h1 style="color:var(--primary-blue); margin:0;">PATIL HOSPITAL</h1>
                     <p style="margin:5px 0 0; color:#666;">Smart Digital Healthcare System</p>
                </div>
                <div style="text-align:right;">
                    <h2 style="color:#333; margin:0;">MEDICAL REPORT</h2>
                    <p style="margin:5px 0 0; color:#666;">ID: #${report.id || '--'}</p>
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:30px; margin-bottom:40px;">
                <div>
                    <h4 style="color:#666; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px;">Patient Details</h4>
                    <div style="font-size:1.2rem; font-weight:600; margin-top:5px;">${appState.user.name}</div>
                    <div style="color:#555;">Age: ${appState.user.age} | Mobile: ${appState.user.mobile}</div>
                </div>
                 <div>
                    <h4 style="color:#666; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px;">Appointment Details</h4>
                    <div style="margin-top:5px;">Date: ${new Date().toLocaleDateString()} (Ref)</div>
                    <!-- We would ideally show Doctor Name here if available -->
                </div>
            </div>

            <div style="margin-bottom:30px;">
                <h4 style="background:#f8f9fa; padding:10px; border-left:4px solid var(--primary-blue); margin-bottom:15px;">DIAGNOSIS</h4>
                <p style="font-size:1.1rem; line-height:1.6;">${report.diagnosis}</p>
                ${report.symptoms ? `<p style="color:#666; font-size:0.9rem; margin-top:5px;"><strong>Symptoms:</strong> ${report.symptoms}</p>` : ''}
            </div>

            <div style="margin-bottom:30px;">
                <h4 style="background:#f8f9fa; padding:10px; border-left:4px solid var(--accent-green); margin-bottom:15px;">PRESCRIPTION (Rx)</h4>
                <div style="font-size:1.1rem; white-space: pre-line; line-height:1.6;">${report.medicines}</div>
            </div>

            <div style="margin-bottom:40px;">
                <h4 style="background:#f8f9fa; padding:10px; border-left:4px solid #f1c40f; margin-bottom:15px;">DOCTOR'S NOTES</h4>
                <p style="color:#555;">${report.notes || 'None'}</p>
                ${report.follow_up_date ? `
                    <div style="margin-top:20px; padding:15px; background:#e8f8f5; border-radius:5px; border:1px solid #2ecc71;">
                        <strong style="color:#27ae60;">📅 Follow-up Required: ${new Date(report.follow_up_date).toDateString()}</strong>
                        <div style="margin-top:10px;">
                            <button class="btn-primary" onclick="window.startBookingWith('${report.dept || 'General Physician'}')">Book Follow-up Now</button>
                        </div>
                    </div>`
            : ''}
            </div>

            <div style="border-top:1px solid #eee; padding-top:30px; text-align:center; display:flex; justify-content:center; gap:15px;" class="no-print">
                <button class="btn-primary" onclick="window.print()">🖨 Print / Download PDF</button>
                <button class="nav-btn" style="border:1px solid #ccc;" onclick="handleDashboardNav('appointments')">Close</button>
            </div>
        </div>
    `;
}

// NEW: Print Function
window.printReport = function () {
    window.print();
};

function renderAppointmentList() {
    const list = document.getElementById('history-list');
    const statusCard = document.getElementById('current-status-card');

    // Sort reverse chronological
    const history = [...appState.appointments].reverse();

    if (history.length === 0) {
        list.innerHTML = '<li style="padding:10px; color:#666;">No history yet.</li>';
        statusCard.textContent = "No active appointments";
        statusCard.style.borderLeftColor = "#666";
    } else {
        const latest = history[0]; // Most recent
        if (latest.status === 'Scheduled') {
            statusCard.innerHTML = `<strong>${latest.dept}</strong><br>ID: #${latest.id} &bull; ${latest.status}`;
            statusCard.style.borderLeftColor = "var(--accent-green)";
        } else {
            statusCard.innerHTML = "No active appointments";
            statusCard.style.borderLeftColor = "#666";
        }

        list.innerHTML = '';
        history.forEach(apt => {
            const li = document.createElement('li');
            li.style.padding = '10px 0';
            li.style.borderBottom = '1px solid #eee';
            li.innerHTML = `<strong>${apt.dept}</strong> - ${apt.date} (#${apt.id})`;
            list.appendChild(li);
        });
    }
}

// 6.b Handle Contact
window.handleContactSubmit = function (e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.textContent;

    // Get Data
    const subject = e.target.querySelector('select').value;
    const message = e.target.querySelector('textarea').value;
    const name = appState.user ? appState.user.name : 'Guest';

    btn.textContent = "Sending...";
    btn.disabled = true;

    fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subject, message })
    })
        .then(res => res.json())
        .then(data => {
            showToast("Message sent successfully!", 'success');
            e.target.reset();
            btn.textContent = originalText;
            btn.disabled = false;
        })
        .catch(err => {
            console.error(err);
            showToast("Failed to send message.", 'error');
            btn.textContent = originalText;
            btn.disabled = false;
        });
};

// --- NEW FEATURES ---

// --- DOCTOR FUNCTIONS ---
function loadDoctorAppointments() {
    const list = document.getElementById('doc-apt-list');
    list.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center;">Loading...</td></tr>';

    fetch('/api/doctor/appointments')
        .then(res => res.json())
        .then(data => {
            list.innerHTML = '';
            if (data.length === 0) {
                list.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center;">No appointments found.</td></tr>';
                return;
            }

            data.forEach(apt => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #eee';

                const actionBtn = apt.status === 'Completed' ?
                    `<button style="color:green; border:1px solid green; background:white; padding:5px 10px; opacity:0.7; cursor:default;">Completed</button>` :
                    `<button class="btn-primary" style="padding:5px 15px; font-size:0.8rem;" onclick="openReportModal(${apt.id}, '${apt.patient_name}')">Write Report</button>`;

                tr.innerHTML = `
                <td style="padding:15px;">#${apt.id}</td>
                <td style="padding:15px;">
                    <div style="font-weight:600;">${apt.patient_name}</div>
                    <div style="font-size:0.85rem; color:#666;">Age: ${apt.patient_age}</div>
                </td>
                <td style="padding:15px;">${apt.date}</td>
                <td style="padding:15px;">${apt.dept}</td>
                <td style="padding:15px;">${apt.status}</td>
                <td style="padding:15px;">${actionBtn}</td>
            `;
                list.appendChild(tr);
            });
        });
}

window.openReportModal = function (aptId, patientName) {
    document.getElementById('report-apt-id').value = aptId;
    document.getElementById('report-patient-name').textContent = `Patient: ${patientName}`;
    document.getElementById('report-form').reset();
    document.getElementById('report-modal').classList.remove('hidden');
};

function saveReport() {
    const data = {
        appointment_id: document.getElementById('report-apt-id').value,
        diagnosis: document.getElementById('report-diagnosis').value,
        medicines: document.getElementById('report-meds').value,
        notes: document.getElementById('report-notes').value
    };

    fetch('/api/doctor/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                showToast('Report Saved Successfully!', 'success');
                document.getElementById('report-modal').classList.add('hidden');
                loadDoctorAppointments(); // Refresh list
            }
        });
}

// 7. Theme Management
function initTheme() {
    if (appState.theme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-toggle').textContent = '☀';
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    appState.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', appState.theme);
    document.getElementById('theme-toggle').textContent = isDark ? '☀' : '🌙';

    showToast(isDark ? 'Dark Mode Enabled' : 'Light Mode Enabled', 'info');
}

// 8. Toast Notification System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    // Icon selection
    let icon = 'ℹ';
    if (type === 'success') icon = '✔';
    if (type === 'error') icon = '✖';

    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span style="font-size:1.2rem;">${icon}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, 3000);
}

function filterDoctors(query) {
    const term = query.toLowerCase();
    const filtered = window.allDoctors.filter(doc =>
        doc.name.toLowerCase().includes(term) ||
        doc.department.toLowerCase().includes(term) ||
        (doc.description && doc.description.toLowerCase().includes(term))
    );

    // Find grid container
    const container = document.getElementById('main-view-container');
    // We need to keep the header and search box, just replace the grid
    const oldGrid = container.querySelector('.grid-container');
    if (oldGrid) oldGrid.remove();

    renderDoctorGrid(filtered, container);
}

function renderDoctorGrid(docs, container) {
    if (docs.length === 0) {
        const noRes = document.createElement('p');
        noRes.className = 'no-results';
        noRes.textContent = 'No doctors found matching your search.';
        noRes.style.textAlign = 'center';
        noRes.style.color = '#666';
        noRes.style.padding = '20px';

        // Check if message already exists
        if (!container.querySelector('.no-results')) container.appendChild(noRes);
        // Also ensure grid is gone (handled by filter function remove)
        return;
    }

    // Remove no-results if exists
    const existingMsg = container.querySelector('.no-results');
    if (existingMsg) existingMsg.remove();

    // 🔴 FIX: Check for existing grid and allow replacing it
    const existingGrid = container.querySelector('.grid-container');
    if (existingGrid) existingGrid.remove();

    const grid = document.createElement('div');
    grid.className = 'grid-container';

    docs.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'dept-card';
        // Find Department Icon
        const deptObj = departments.find(dep => dep.name === doc.department);
        const deptIcon = deptObj ? deptObj.icon : '🩺';

        card.style.textAlign = 'left';
        card.style.alignItems = 'flex-start';
        card.style.padding = '25px';
        card.style.position = 'relative';

        const status = (doc.status || 'unavailable').toLowerCase();
        const isAvailable = status === 'available';
        const isBusy = status === 'busy';

        const statusColor = isAvailable ? 'text-green' : (isBusy ? 'text-orange' : 'text-red');
        const statusText = isAvailable ? 'Available' : (isBusy ? 'Busy' : 'Not Available');
        const statusDot = isAvailable ? 'available' : (isBusy ? 'busy' : 'unavailable');

        card.innerHTML = `
            <div style="margin-bottom: 20px;">
                <div style="font-size: 2.5rem; margin-bottom: 10px;">${deptIcon}</div>
                <h4 style="font-size: 1.3rem; margin-bottom: 5px; color: var(--text-dark);">${doc.department}</h4>
                <p style="color: #666; font-size: 0.9rem; line-height: 1.5;">${doc.description || 'Specialist consultation available.'}</p>
            </div>

            <hr style="width: 100%; border: 0; border-top: 1px solid #eee; margin-bottom: 20px;">

            <div style="margin-bottom: 5px;">
                <h5 style="font-size: 1rem; font-weight: 600; color: var(--text-dark);">${doc.name}</h5>
            </div>
            
            <div style="margin-bottom: 15px; color: #555; font-size: 0.9rem;">
                    <span style="color: #888;">Room:</span> <strong style="color:#333;">${doc.room_number || 'N/A'}</strong>
            </div>
            
            <div class="doc-availability" style="justify-content: flex-start; margin-bottom: 25px;">
                <span class="status-dot ${statusDot}"></span>
                <span class="${statusColor}" style="font-weight: 500;">${statusText} Now</span>
            </div>

            <button class="btn-primary" style="width: 100%; border-radius: 6px; font-weight: 600;" onclick="window.startBookingWith('${doc.department}')">Book Appointment</button>
        `;
        grid.appendChild(card);
    });
    container.appendChild(grid);
}
