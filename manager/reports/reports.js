(function() {
    const manager = localStorage.getItem("manager");
    if (!manager) {
        window.location.href = "../login/login.html"; 
    }
})();
const API = "http://127.0.0.1:5000/manager";
const getEl = (id) => document.getElementById(id);

let charts = {}; // Store chart instances

// ===== UI Elements & Sidebar Logic =====
const sidebar = document.getElementById('sidebar');
const sidebarArrow = document.getElementById('sidebar-arrow');
const mobileToggle = document.getElementById('mobile-sidebar-toggle');
const closeSidebarBtn = document.getElementById('close-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay'); 
const btnLogout = document.getElementById('btn-logout');
const themeToggle = document.getElementById('theme-toggle');
const monthSelector = document.getElementById('month-selector');

// ===== CHART TOGGLE COLLAPSE =====
document.querySelectorAll('.toggle-chart').forEach(icon => {
    icon.addEventListener('click', function() {
        const card = this.closest('.chart-card');
        card.classList.toggle('collapsed');
    });
});

// ===== POPULATE MONTH SELECTOR =====
function initMonthSelector() {
    const d = new Date();
    for(let i=0; i<12; i++) {
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const val = `${y}-${m}`;
        const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        monthSelector.add(new Option(label, val));
        d.setMonth(d.getMonth() - 1);
    }
    monthSelector.addEventListener('change', loadReports);
}

// ===== CHART FILTERS LOGIC =====
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        const filter = e.currentTarget.dataset.filter;
        
        document.querySelectorAll('.chart-card').forEach(card => {
            if (filter === 'all' || card.dataset.category === filter) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    });
});

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
        loadReports(); 
    });
}

function updateThemeIcon(theme) {
    if(themeToggle) {
        themeToggle.innerHTML = theme === 'light' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
    }
}

// ===== Sidebar Interactions =====
if(sidebarArrow) sidebarArrow.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
if(mobileToggle) mobileToggle.addEventListener('click', () => { sidebar.classList.add('mobile-active'); sidebarOverlay.classList.add('active'); });
if(closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => { sidebar.classList.remove('mobile-active'); sidebarOverlay.classList.remove('active'); });
if(sidebarOverlay) sidebarOverlay.addEventListener('click', () => { sidebar.classList.remove('mobile-active'); sidebarOverlay.classList.remove('active'); });

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

// ================= REPORTS LOGIC =================
async function loadReports() {
    try {
        const selectedMonth = monthSelector.value;
        const res = await fetch(`${API}/reports?month=${selectedMonth}`);
        const data = await res.json();

        if(!data.success) return console.error(data.message);

        // Update KPIs
        getEl('kpi-revenue').textContent = `${data.kpis.revenue.toLocaleString()} EGP`;
        getEl('kpi-orders').textContent = data.kpis.orders.toLocaleString();
        getEl('kpi-aov').textContent = `${data.kpis.aov} EGP`;
        getEl('kpi-discounts').textContent = `${data.kpis.discounts.toLocaleString()} EGP`;

        const formatGrowth = (val, el) => {
            el.textContent = `${val > 0 ? '+' : ''}${val}% vs prev month`;
            el.className = `kpi-delta ${val >= 0 ? 'positive' : 'negative'}`;
        };
        formatGrowth(data.kpis.revenue_growth, getEl('kpi-revenue-growth'));
        formatGrowth(data.kpis.orders_growth, getEl('kpi-orders-growth'));

        // Update Financial Summary
        getEl('breakdown-month-badge').textContent = monthSelector.options[monthSelector.selectedIndex].text;
        getEl('sum-subtotal').textContent = `${data.finances.subtotal.toLocaleString()} EGP`;
        getEl('sum-tax').textContent = `${data.finances.tax.toLocaleString()} EGP`;
        getEl('sum-delivery').textContent = `${data.finances.delivery.toLocaleString()} EGP`;
        getEl('sum-discount').textContent = `-${data.finances.discount.toLocaleString()} EGP`;
        getEl('sum-total').textContent = `${data.finances.total.toLocaleString()} EGP`;

        // Update Insights
        if (data.best_month.month !== "N/A") {
            const bDate = new Date(data.best_month.month + "-01");
            const bName = bDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            getEl('insight-best-month').textContent = `${bName} (${data.best_month.revenue.toLocaleString()} EGP)`;
            getEl('insight-best-reason').textContent = data.best_month.reason;
        } else {
            getEl('insight-best-month').textContent = "Not enough data";
        }

        if (data.bottom_dishes && data.bottom_dishes.length > 0) {
            getEl('insight-menu-warning').textContent = `'${data.bottom_dishes[0].name}'`;
        }

        // Prepare Chart Colors
        const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
        Chart.defaults.color = isLightMode ? '#64748b' : '#94a3b8';
        Chart.defaults.font.family = "'Inter', sans-serif";
        const gridColor = isLightMode ? 'rgba(226, 232, 240, 0.8)' : 'rgba(51, 65, 85, 0.5)';

        const renderChart = (id, config) => {
            const ctx = getEl(id)?.getContext('2d');
            if (!ctx) return;
            if (charts[id]) charts[id].destroy();
            charts[id] = new Chart(ctx, config);
        };

        // 1. ALL-TIME YEARLY REVENUE
        renderChart('allYearsChart', {
            type: 'bar',
            data: {
                labels: data.all_years_comp.map(d => d.year),
                datasets: [{ label: 'Total Revenue (EGP)', data: data.all_years_comp.map(d => d.revenue), backgroundColor: '#8b5cf6', borderRadius: 6 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: gridColor } } } }
        });

        // 2. Yearly Comparison Chart
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        renderChart('yearlyCompChart', {
            type: 'line',
            data: {
                labels: monthNames,
                datasets: [
                    { label: `Year ${data.target_year} (EGP)`, data: data.yearly_comparison.current, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 3, fill: true, tension: 0.4 },
                    { label: `Year ${data.prev_year} (EGP)`, data: data.yearly_comparison.previous, borderColor: isLightMode ? '#94a3b8' : '#475569', borderDash: [5,5], borderWidth: 2, fill: false, tension: 0.4 },
                    { label: `Year ${data.prev2_year} (EGP)`, data: data.yearly_comparison.previous2, borderColor: isLightMode ? '#cbd5e1' : '#334155', borderDash: [2,2], borderWidth: 2, fill: false, tension: 0.4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top' } }, scales: { x: { grid: { display: false } }, y: { grid: { color: gridColor } } } }
        });

        // 3. Revenue by Type
        const typeLabels = Object.keys(data.rev_by_type);
        const typeValues = Object.values(data.rev_by_type);
        renderChart('revenueTypeChart', {
            type: 'doughnut',
            data: { labels: typeLabels, datasets: [{ data: typeValues, backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#cbd5e1'], borderWidth: isLightMode ? 2 : 0, borderColor: isLightMode ? '#fff' : 'transparent' }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom' } } }
        });

        // 4. Top Dishes
        renderChart('topDishesChart', {
            type: 'bar',
            data: { labels: data.popular_dishes.map(d => d.name.substring(0, 15) + (d.name.length > 15 ? '...' : '')), datasets: [{ label: 'Quantity Sold', data: data.popular_dishes.map(d => d.sold), backgroundColor: '#10b981', borderRadius: 6 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor } }, y: { grid: { display: false } } } }
        });

        // 5. Bottom Dishes
        renderChart('bottomDishesChart', {
            type: 'bar',
            data: { labels: data.bottom_dishes.map(d => d.name.substring(0, 15) + (d.name.length > 15 ? '...' : '')), datasets: [{ label: 'Quantity Sold', data: data.bottom_dishes.map(d => d.sold), backgroundColor: '#ef4444', borderRadius: 6 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor }, ticks: { stepSize: 1 } }, y: { grid: { display: false } } } }
        });

    } catch(err) { console.error("Reports Error:", err); }
}

// Download PDF
document.getElementById("downloadReportBtn")?.addEventListener("click", () => window.location.href = `${API}/download-report`);

// INIT
document.addEventListener("DOMContentLoaded", () => {
    initMonthSelector();
    loadReports();
});