(function() {
    const manager = localStorage.getItem("manager");
    if (!manager) {
        window.location.href = "../login/login.html"; // تأكد من المسار الصحيح لصفحة اللوجن
    }
})();

const API = "http://127.0.0.1:5000/manager";
const getEl = (id) => document.getElementById(id);

let globalFeedbacks = [];

// ===== UI Elements & Sidebar Logic =====
const sidebar = document.getElementById('sidebar');
const sidebarArrow = document.getElementById('sidebar-arrow');
const mobileToggle = document.getElementById('mobile-sidebar-toggle');
const closeSidebarBtn = document.getElementById('close-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay'); 
const btnLogout = document.getElementById('btn-logout');
const themeToggle = document.getElementById('theme-toggle');

// ===== LIGHT / DARK MODE TOGGLE =====
const currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeIcon(currentTheme);

if(themeToggle) {
    themeToggle.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        theme = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        updateThemeIcon(theme);
    });
}

function updateThemeIcon(theme) {
    if(themeToggle) {
        themeToggle.innerHTML = theme === 'light' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
    }
}

// ===== Sidebar Interactions =====
if(sidebarArrow) sidebarArrow.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

if(mobileToggle) mobileToggle.addEventListener('click', () => { 
    sidebar.classList.add('mobile-active'); 
    sidebarOverlay.classList.add('active'); 
});

if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => { 
    sidebar.classList.remove('mobile-active'); 
    sidebarOverlay.classList.remove('active'); 
});

if(sidebarOverlay) sidebarOverlay.addEventListener('click', () => { 
    sidebar.classList.remove('mobile-active'); 
    sidebarOverlay.classList.remove('active'); 
});

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        if(window.innerWidth <= 768) {
            sidebar.classList.remove('mobile-active');
            if(sidebarOverlay) sidebarOverlay.classList.remove('active');
        }
        const page = this.getAttribute('data-target');
        if (page && page !== "#") window.location.href = page;
    });
});

// ===== Logout =====
if(btnLogout){
    btnLogout.addEventListener('click', () => {
        localStorage.removeItem("manager");
        window.location.href = "../login/login.html";
    });
}

// ================= LOAD & RENDER FEEDBACKS =================
async function loadFeedback() {
    const container = getEl('feedback-cards-container');
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading feedbacks...</div>';
    
    try {
        const res = await fetch(`${API}/feedback`);
        globalFeedbacks = await res.json();

        updateKPIs(globalFeedbacks);
        renderFeedbacks(globalFeedbacks);

    } catch (err) {
        console.error("Load Feedback Error:", err);
        container.innerHTML = '<div class="empty-state" style="color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load feedback data. Check connection.</div>';
    }
}

function updateKPIs(data) {
    if (!data || data.length === 0) return;

    const total = data.length;
    const avg = data.reduce((sum, item) => sum + parseInt(item.rating), 0) / total;
    const happy = data.filter(item => parseInt(item.rating) >= 4).length;
    const needsAttention = data.filter(item => parseInt(item.rating) <= 2).length;

    getEl('kpi-total').textContent = total;
    getEl('kpi-avg').innerHTML = `${avg.toFixed(1)} <i class="fa-solid fa-star" style="color: var(--star-active); font-size:16px;"></i>`;
    getEl('kpi-happy').textContent = `${Math.round((happy / total) * 100)}%`;
    getEl('kpi-needs-attention').textContent = needsAttention;
}

function renderFeedbacks(data) {
    const container = getEl('feedback-cards-container');
    
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-ghost fa-2x mb-2"></i><br>No matching feedbacks found.</div>';
        return;
    }

    container.innerHTML = data.map(fb => {
        const rating = parseInt(fb.rating);
        
        // تحديد لون النجوم وحواف الكارت بناءً على التقييم
        let starColorClass = 'active'; // اللون الافتراضي (أصفر) لـ 3 نجوم
        let cardGlowClass = ''; // الكلاس الخاص بتأثير الإضاءة على الحواف

        if(rating <= 2) {
            starColorClass = 'active bad'; // أحمر لـ 1 أو 2 نجمة
            cardGlowClass = 'bad-glow'; // إضاءة حمراء للكارت
        } else if (rating >= 4) {
            starColorClass = 'active good'; // أخضر لـ 4 أو 5 نجوم
            cardGlowClass = 'good-glow'; // إضاءة خضراء للكارت
        }

        // Generate stars HTML
        let starsHTML = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                starsHTML += `<i class="fa-solid fa-star ${starColorClass}"></i>`;
            } else {
                starsHTML += `<i class="fa-solid fa-star"></i>`; // النجوم الفاضية
            }
        }

        // Tags HTML
        let tagsHTML = '';
        if (fb.tags && fb.tags !== '-') {
            tagsHTML = fb.tags.split(',').map(tag => `<span class="fb-tag">${tag.trim()}</span>`).join('');
        }

        // Customer Name processing
        const custName = fb.customer_name || `Customer #${fb.customer_id}`;
        const initial = custName.charAt(0).toUpperCase();

        return `
            <div class="feedback-card ${cardGlowClass}">
                <div class="fb-header">
                    <div class="fb-customer">
                        <div class="fb-avatar">${initial}</div>
                        <div>
                            <div class="fb-name">${custName}</div>
                            <div class="fb-date">${fb.date}</div>
                        </div>
                    </div>
                    <div class="fb-order-id">Order #${fb.order_id}</div>
                </div>
                <div class="fb-stars">${starsHTML}</div>
                <div class="fb-comment">" ${fb.comment} "</div>
                <div class="fb-tags">${tagsHTML}</div>
            </div>
        `;
    }).join('');
}

// ================= SEARCH & FILTER LOGIC =================
function applyFilters() {
    const search = getEl('fb-search').value.toLowerCase();
    const ratingFilter = getEl('fb-filter-rating').value;

    const filtered = globalFeedbacks.filter(fb => {
        // Search
        const custName = (fb.customer_name || `Customer #${fb.customer_id}`).toLowerCase();
        const matchesSearch = custName.includes(search) || 
                              fb.order_id.toString().includes(search) || 
                              (fb.comment && fb.comment.toLowerCase().includes(search));
        
        // Rating Filter
        const r = parseInt(fb.rating);
        let matchesRating = true;
        
        if (ratingFilter === '5') matchesRating = (r === 5);
        else if (ratingFilter === '4') matchesRating = (r >= 4);
        else if (ratingFilter === '3') matchesRating = (r === 3);
        else if (ratingFilter === 'negative') matchesRating = (r <= 2);

        return matchesSearch && matchesRating;
    });

    renderFeedbacks(filtered);
}

// Event Listeners for Filters
getEl('fb-search').addEventListener('input', applyFilters);
getEl('fb-filter-rating').addEventListener('change', applyFilters);

// Init
document.addEventListener("DOMContentLoaded", loadFeedback);