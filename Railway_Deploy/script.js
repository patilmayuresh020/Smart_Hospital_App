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

// Data: Departments (Icons only)
const departments = [
    { id: 'gen', name: 'General Physician', icon: '🩺' },
    { id: 'den', name: 'Dental', icon: '🦷' },
    { id: 'ent', name: 'ENT', icon: '👂' },
    { id: 'orth', name: 'Orthopedic', icon: '🦴' },
    { id: 'card', name: 'Cardiology', icon: '❤️' },
    { id: 'ped', name: 'Pediatrics', icon: '👶' }
];

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
                <div>
                     <button class="nav-btn" style="border:1px solid #ccc; margin-right:10px;" onclick="window.showEntryPass()">🎫 View Entry Pass</button>
                     <button class="btn-primary" style="width:auto;" onclick="window.startBooking()">+ Book New</button>
                </div>
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
                             ${apt.follow_up_date ?
                                `<br><span style="font-size:0.85rem; color:#d35400; background:#fff3cd; padding:2px 6px; border-radius:4px; margin-top:5px; display:inline-block;">📅 Follow-up: ${new Date(apt.follow_up_date).toLocaleDateString()}</span>`
                                : ''}
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
                
                // Show Entry pass option
                setTimeout(() => window.showEntryPass(), 1000);
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
}

function renderDoctorGrid(doctors, container) {
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    grid.style.gap = '20px'; // Increased gap
    grid.style.marginTop = '20px';

    doctors.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'dept-card';
        // Status indicator
        let statusColor = '#27ae60'; // Available
        let statusText = 'Available';
        if (doc.status === 'Busy') { statusColor = '#f39c12'; statusText = 'In Consultation'; }
        if (doc.status === 'Off') { statusColor = '#e74c3c'; statusText = 'Off Duty'; }

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div>
                     <!-- Initials Avatar -->
                     <div class="avatar" style="width:50px; height:50px; font-size:1.2rem; margin-bottom:10px; background:var(--primary-blue);">
                        ${doc.name.split(' ').map(n=>n[0]).join('').substring(0,2)}
                     </div>
                     <h3 style="margin:0 0 5px 0;">${doc.name}</h3>
                     <span style="color:#666; font-size:0.9rem;">${doc.department}</span>
                </div>
                <div style="text-align:right;">
                    <div style="display:flex; align-items:center; gap:5px; justify-content:flex-end;">
                        <span style="width:8px; height:8px; border-radius:50%; background:${statusColor}; display:inline-block;"></span>
                        <span style="font-size:0.8rem; color:${statusColor}; font-weight:600;">${statusText}</span>
                    </div>
                    ${doc.room_number ? `<div style="font-size:0.8rem; color:#888; margin-top:5px;">Room: ${doc.room_number}</div>` : ''}
                </div>
            </div>
            
            <div style="margin:15px 0; border-top:1px solid #eee; padding-top:10px;">
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#555;">
                    <span>Wait Time: <strong>~${doc.queue_total ? (doc.queue_total - doc.queue_current) * 15 : 15} min</strong></span>
                    <span>Tokens: <strong>${doc.queue_current || 0} / ${doc.queue_total || 0}</strong></span>
                </div>
            </div>

            <button class="btn-primary" style="width:100%;" onclick="window.startBookingWith('${doc.department}')" ${doc.status === 'Off' ? 'disabled' : ''}>
                ${doc.status === 'Off' ? 'Unavailable' : 'Book Appointment'}
            </button>
        `;
        grid.appendChild(card);
    });
    container.appendChild(grid);
}

function filterDoctors(query) {
    const container = document.getElementById('main-view-container');
    const grid = container.querySelector('div[style*="grid"]'); // Find the grid
    if (!grid) return; // Should not happen

    query = query.toLowerCase();
    
    // Clear current grid
    grid.innerHTML = '';
    
    // Filter from global state
    const filtered = window.allDoctors.filter(doc => 
        doc.name.toLowerCase().includes(query) || 
        doc.department.toLowerCase().includes(query)
    );
    
    if (filtered.length === 0) {
        grid.innerHTML = '<p class="text-red">No doctors found matching your search.</p>';
    } else {
        // Re-render items (Logic copied from renderDoctorGrid for simplicity, or we should reuse the card creation logic)
        // Ideally refactor card creation into function createDoctorCard(doc)
        
        // Quick hack: clear grid and call renderDoctorGrid's logic partially? 
        // Better: create separate function for rendering cards
        
        // Re-implementing card render inside filter for now to be safe
         filtered.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'dept-card';
            let statusColor = '#27ae60'; 
            let statusText = 'Available';
            if (doc.status === 'Busy') { statusColor = '#f39c12'; statusText = 'In Consultation'; }
            if (doc.status === 'Off') { statusColor = '#e74c3c'; statusText = 'Off Duty'; }

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                         <div class="avatar" style="width:50px; height:50px; font-size:1.2rem; margin-bottom:10px; background:var(--primary-blue);">
                            ${doc.name.split(' ').map(n=>n[0]).join('').substring(0,2)}
                         </div>
                         <h3 style="margin:0 0 5px 0;">${doc.name}</h3>
                         <span style="color:#666; font-size:0.9rem;">${doc.department}</span>
                    </div>
                    <div style="text-align:right;">
                        <div style="display:flex; align-items:center; gap:5px; justify-content:flex-end;">
                            <span style="width:8px; height:8px; border-radius:50%; background:${statusColor}; display:inline-block;"></span>
                            <span style="font-size:0.8rem; color:${statusColor}; font-weight:600;">${statusText}</span>
                        </div>
                        ${doc.room_number ? `<div style="font-size:0.8rem; color:#888; margin-top:5px;">Room: ${doc.room_number}</div>` : ''}
                    </div>
                </div>
                
                <div style="margin:15px 0; border-top:1px solid #eee; padding-top:10px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#555;">
                        <span>Wait Time: <strong>~${doc.queue_total ? (doc.queue_total - doc.queue_current) * 15 : 15} min</strong></span>
                        <span>Tokens: <strong>${doc.queue_current || 0} / ${doc.queue_total || 0}</strong></span>
                    </div>
                </div>

                <button class="btn-primary" style="width:100%;" onclick="window.startBookingWith('${doc.department}')" ${doc.status === 'Off' ? 'disabled' : ''}>
                    ${doc.status === 'Off' ? 'Unavailable' : 'Book Appointment'}
                </button>
            `;
            grid.appendChild(card);
        });
    }
}


// --- QR CODE FUNCTIONS ---

// 1. Patient: Generate Pass
window.showEntryPass = function() {
    if (!appState.user) return showToast("Please login first!", "error");
    
    // Create payload
    const data = {
        m: appState.user.mobile,
        n: appState.user.name.split(' ')[0], // First name only to save space
    };
    const qrData = JSON.stringify(data);
    
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = ''; // Clear previous
    
    // Correct usage of QRCode library
    new QRCode(qrContainer, {
        text: qrData,
        width: 180,
        height: 180,
        colorDark : "#2c3e50",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M
    });
    
    document.getElementById('qr-name').textContent = appState.user.name;
    document.getElementById('qr-mobile').textContent = appState.user.mobile;
    document.getElementById('qr-modal').classList.remove('hidden');
};

// 2. Doctor: Scan QR
let scanner = null; // Scanner instance

window.openScanner = function() {
    document.getElementById('scanner-modal').classList.remove('hidden');
    
    // Initialize Scanner
    if (!scanner) {
        scanner = new Html5QrcodeScanner(
            "reader", 
            { fps: 10, qrbox: {width: 250, height: 250}, aspectRatio: 1.0 },
            /* verbose= */ false
        );
        scanner.render(onScanSuccess, onScanFailure);
    }
};

window.closeScanner = function() {
    document.getElementById('scanner-modal').classList.add('hidden');
    // We keep scanner instance alive but hidden to avoid re-init issues, 
    // or we could clear it. For simplicity, just hide modal.
    // Ideally: scanner.clear(); scanner = null;
    if(scanner) {
        scanner.clear().then(() => {
            scanner = null;
            document.getElementById('reader').innerHTML = "";
        }).catch(err => console.error(err));
    }
};

function onScanSuccess(decodedText, decodedResult) {
    // Handle the scanned code
    console.log(`Scan result: ${decodedText}`);
    try {
        const data = JSON.parse(decodedText);
        if(data.m) {
            // Found mobile!
            closeScanner();
            showToast(`Patient Found: ${data.n || 'Unknown'}`, 'success');
            
            // Trigger History View
            // We need to call viewHistory which is in the doctor.html script tag...
            // Wait, script.js handles SHARED logic, but doctor.html has specific logic in a script tag.
            // Using window.viewHistory from doctor.html scope.
             if (window.viewHistory) {
                 window.viewHistory(data.m, data.n || 'Scanned User');
             } else {
                 console.error("viewHistory function not found in scope");
             }
        } else {
            alert("Invalid QR Code");
        }
    } catch(e) {
        console.error(e);
        // Maybe it's not JSON?
        alert("Invalid QR Format");
    }
}

function onScanFailure(error) {
    // handle scan failure, usually better to ignore and keep scanning.
    // console.warn(`Code scan error = ${error}`);
}
