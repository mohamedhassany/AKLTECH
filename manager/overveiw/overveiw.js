(function() {
    const manager = localStorage.getItem("manager");
    if (!manager) {
        window.location.href = "../login/login.html"; // تأكد من المسار الصحيح لصفحة اللوجن
    }
})();
const API = "http://127.0.0.1:5000/manager";

// ===== UI Elements =====
const sidebar = document.getElementById('sidebar');
const sidebarArrow = document.getElementById('sidebar-arrow');
const mobileToggle = document.getElementById('mobile-sidebar-toggle');
const closeSidebarBtn = document.getElementById('close-sidebar'); // زر الإغلاق الجديد
const sidebarOverlay = document.getElementById('sidebar-overlay'); 
const btnLogout = document.getElementById('btn-logout');
const themeToggle = document.getElementById('theme-toggle');

// ===== LIGHT / DARK MODE TOGGLE =====
const currentTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeIcon(currentTheme);

if(themeToggle) {
    themeToggle.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        theme = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        updateThemeIcon(theme);
        loadMainOverview(); 
    });
}
function updateThemeIcon(theme) {
    if(themeToggle) {
        if(theme === 'light') {
            themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
        } else {
            themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
    }
}

// ===== Smart Greeting =====
const setGreeting = () => {
    const hour = new Date().getHours();
    const greetingEl = document.getElementById('greeting-text');
    if(hour < 12) greetingEl.textContent = "Good Morning, Manager! ☀️";
    else if(hour < 18) greetingEl.textContent = "Good Afternoon, Manager! 🌤️";
    else greetingEl.textContent = "Good Evening, Manager! 🌙";
};
setGreeting();

// ================= SIDEBAR TOGGLES =================

// للديسكتوب
if(sidebarArrow){
    sidebarArrow.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

// للموبايل (فتح القائمة)
if(mobileToggle){
    mobileToggle.addEventListener('click', () => {
        sidebar.classList.add('mobile-active');
        sidebarOverlay.classList.add('active');
    });
}

// للموبايل (قفل القائمة عن طريق زرار X)
if(closeSidebarBtn){
    closeSidebarBtn.addEventListener('click', () => {
        sidebar.classList.remove('mobile-active');
        sidebarOverlay.classList.remove('active');
    });
}

// للموبايل (قفل القائمة لو داس على الخلفية الشفافة)
if(sidebarOverlay){
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('mobile-active');
        sidebarOverlay.classList.remove('active');
    });
}

// ================= PAGE NAVIGATION & AUTO-CLOSE SIDEBAR =================
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        // قفل القائمة أوتوماتيك لما يختار صفحة
        if(window.innerWidth <= 768) {
            sidebar.classList.remove('mobile-active');
            if(sidebarOverlay) sidebarOverlay.classList.remove('active');
        }

        const page = this.getAttribute('data-target');
        if (page && page !== "#") {
            window.location.href = page;
        }
    });
});

// ================= LOGOUT =================
if(btnLogout){
    btnLogout.addEventListener('click', () => {
        localStorage.removeItem("manager");
        window.location.href = "../login/login.html";
    });
}

// ================= MAIN OVERVIEW (Real Data & Charts) =================
document.addEventListener("DOMContentLoaded", loadMainOverview);

async function loadMainOverview(){
    try {
        const res = await fetch(`${API}/main-overview`);
        const data = await res.json();
        
        if(!data.success) {
            console.error("Backend Error:", data.message);
            return;
        }

        document.getElementById('kpi-orders').textContent = data.total_orders || 0;
        document.getElementById('kpi-revenue').textContent = `${(data.total_sales || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} EGP`;
        document.getElementById('kpi-reservations').textContent = data.active_reservations || 0;
        document.getElementById('kpi-feedback').textContent = `${data.total_feedback || 0} (${data.avg_rating || 0}⭐)`;

        const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
        Chart.defaults.color = isLightMode ? '#64748b' : '#94a3b8';
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.scale.grid.color = isLightMode ? 'rgba(226, 232, 240, 0.8)' : 'rgba(51, 65, 85, 0.5)';
        Chart.defaults.scale.grid.borderColor = 'transparent';

        function renderChart(id, config){
            const el = document.getElementById(id);
            if(!el) return;
            const ctx = el.getContext('2d');
            if(window[id + "Chart"]) window[id + "Chart"].destroy();
            window[id + "Chart"] = new Chart(ctx, config);
            return ctx;
        }

        const peakCtx = document.getElementById('peakChart').getContext('2d');
        const peakGradient = peakCtx.createLinearGradient(0, 0, 0, 300);
        peakGradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
        peakGradient.addColorStop(1, isLightMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.2)');

        renderChart('peakChart', {
            type:'bar',
            data:{
                labels:(data.peak_hours||[]).map(i=>i.hour+":00"),
                datasets:[{
                    label: 'Orders', 
                    data: (data.peak_hours||[]).map(i=>i.orders), 
                    backgroundColor: peakGradient,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options:{
                responsive:true, 
                maintainAspectRatio:false,
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        suggestedMax: 5, 
                        ticks: { stepSize: 1 } 
                    } 
                }
            }
        });

        const revCtx = document.getElementById('revenueChart').getContext('2d');
        const revGradient = revCtx.createLinearGradient(0, 0, 0, 300);
        revGradient.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
        revGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        renderChart('revenueChart', {
            type:'line',
            data:{
                labels:(data.weekly_revenue||[]).map(i=>i.day||''),
                datasets:[{
                    label:'Revenue (EGP)', 
                    data:(data.weekly_revenue||[]).map(i=>i.revenue), 
                    borderColor:'#10b981', 
                    backgroundColor: revGradient,
                    borderWidth: 3,
                    pointBackgroundColor: isLightMode ? '#fff' : '#1e293b',
                    pointBorderColor: '#10b981',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill:true, 
                    tension:0.4
                }]
            },
            options:{
                responsive:true, 
                maintainAspectRatio:false,
                plugins: { legend: { display: false } },
                interaction: { mode: 'index', intersect: false },
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        suggestedMax: 100 
                    } 
                }
            }
        });

        const types = data.order_types || {dinein:0, takeaway:0, delivery:0, reservation:0};
        const typeData = [types.dinein, types.takeaway, types.delivery, types.reservation];
        const isEmpty = typeData.every(val => val === 0);

        renderChart('orderChart', {
            type:'doughnut',
            data:{
                labels: isEmpty ? ['No Orders Yet'] : ['Dine-in', 'Take-away', 'Delivery', 'Reservation'],
                datasets:[{
                    data: isEmpty ? [1] : typeData, 
                    backgroundColor: isEmpty ? [isLightMode ? '#e2e8f0' : '#334155'] : ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'],
                    borderWidth: isLightMode && !isEmpty ? 2 : 0,
                    borderColor: isLightMode ? '#fff' : 'transparent',
                    hoverOffset: isEmpty ? 0 : 4
                }]
            },
            options:{
                responsive:true, 
                maintainAspectRatio:false, 
                cutout:'75%',
                plugins: {
                    legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, pointStyle: 'circle' } },
                    tooltip: { enabled: !isEmpty }
                }
            }
        });

    } catch(err){
        console.error("Network or Fetch Error:", err);
    }
}

// ======= Change Password Modal =======
const loggedStaffId = 100;

const changePassModal = document.getElementById('change-password-modal');
const btnChangePassword = document.getElementById('btn-change-password');
const closeBtn = document.querySelector('.close');

if(btnChangePassword) btnChangePassword.addEventListener('click', ()=> changePassModal.style.display='flex');
if(closeBtn) closeBtn.addEventListener('click', ()=> changePassModal.style.display='none');
window.addEventListener('click', (e) => { if(e.target === changePassModal) changePassModal.style.display='none'; });

const savePasswordBtn = document.getElementById('save-new-password');
if(savePasswordBtn) {
    savePasswordBtn.addEventListener('click', async () => {
        const oldPass = document.getElementById('old-password').value;
        const newPass = document.getElementById('new-password').value;
        const confirmPass = document.getElementById('confirm-password').value;

        if(!oldPass || !newPass || !confirmPass){ alert('Please fill all fields'); return; }
        if(newPass !== confirmPass){ alert('Passwords do not match'); return; }

        try{
            savePasswordBtn.textContent = 'Saving...';
            const res = await fetch(`${API}/change-password`, {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ staff_id: loggedStaffId, old_password: oldPass, new_password: newPass })
            });

            const data = await res.json();
            alert(data.message);

            if(data.success){
                changePassModal.style.display='none';
                document.querySelectorAll('.input-field').forEach(input => input.value = '');
            }
        } catch(err){
            console.error("Password Change Error:", err);
            alert("Error changing password");
        } finally {
            savePasswordBtn.textContent = 'Save Changes';
        }
    });
   // ==========================
// OPEN MODAL + LOAD CASHIERS
// ==========================
function openResetModal() {
    document.getElementById("resetModal").style.display = "flex";

    let select = document.getElementById("cashierSelect");
    select.innerHTML = "<option>Loading...</option>";

    fetch('http://127.0.0.1:5000/manager/cashiers')
        .then(res => {
            if (!res.ok) throw new Error("Server error " + res.status);
            return res.json();
        })
        .then(data => {
            console.log("Cashiers:", data);

            select.innerHTML = "";

            if (!Array.isArray(data) || data.length === 0) {
                select.innerHTML = "<option>No cashiers found</option>";
                return;
            }

            data.forEach(c => {
                let option = document.createElement("option");
                option.value = c.id;
                option.textContent = c.name;
                select.appendChild(option);
            });
        })
        .catch(err => {
            console.error("Error loading cashiers:", err);
            select.innerHTML = "<option>Error loading data</option>";
        });
}

// ==========================
// CLOSE MODAL
// ==========================
function closeResetModal() {
    document.getElementById("resetModal").style.display = "none";
}

// ==========================
// RESET PASSWORD
// ==========================
function submitReset() {
    let staff_id = document.getElementById("cashierSelect").value;
    let password = document.getElementById("newPassword").value;

    console.log("Submitting:", staff_id, password);

    if (!staff_id) {
        alert("Please select a cashier");
        return;
    }

    if (!password || password.length < 8) {
        alert("Password must be at least 8 characters");
        return;
    }

    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

    if (!regex.test(password)) {
        alert("Password must contain uppercase, lowercase, number, and special character");
        return;
    }

    fetch(`http://127.0.0.1:5000/manager/reset-password/${staff_id}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ password: password })
    })
    .then(res => {
        console.log("STATUS:", res.status);

        if (!res.ok) {
            return res.json().then(err => { throw err; });
        }

        return res.json();
    })
    .then(data => {
        console.log("Response:", data);
        alert(data.message);

        if (data.success) {
            closeResetModal();
            document.getElementById("newPassword").value = "";
        }
    })
    .catch(err => {
        console.error("ERROR:", err);
        alert(err.message || "Something went wrong");
    });
}
}