const API = "http://127.0.0.1:5000/manager";

const getEl = (id) => document.getElementById(id);

let timelineChartObj, yoyChartObj, weeklyChartObj;
let currentChartData = null; 

// ===== UI Elements =====
const sidebar = document.getElementById('sidebar');
const sidebarArrow = document.getElementById('sidebar-arrow');
const mobileToggle = document.getElementById('mobile-sidebar-toggle');
const closeSidebarBtn = document.getElementById('close-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay'); 
const btnLogout = document.getElementById('btn-logout');
const themeToggle = document.getElementById('theme-toggle');

// ===== THEME =====
let currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeIcon(currentTheme);

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        currentTheme = document.documentElement.getAttribute('data-theme');
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('theme', currentTheme);

        updateThemeIcon(currentTheme);

        if (currentChartData) {
            renderCharts(currentChartData);
        }
    });
}

function updateThemeIcon(theme) {
    if (themeToggle) {
        themeToggle.innerHTML =
            theme === 'light'
                ? '<i class="fa-solid fa-moon"></i>'
                : '<i class="fa-solid fa-sun"></i>';
    }
}

// ===== SIDEBAR EVENTS =====
if (sidebarArrow) sidebarArrow.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
        sidebar.classList.add('mobile-active');
        sidebarOverlay.classList.add('active');
    });
}

const closeMenu = () => {
    sidebar.classList.remove('mobile-active');
    sidebarOverlay.classList.remove('active');
};

if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeMenu);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMenu);

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function () {
        if (window.innerWidth <= 768) closeMenu();
        const page = this.getAttribute('data-target');
        if (page && page !== "#") window.location.href = page;
    });
});

if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        localStorage.removeItem("manager");
        window.location.href = "../login/login.html";
    });
}

// ===== FETCH DATA =====
async function fetchAIForecasts() {
    try {
        const res = await fetch(`${API}/ai-forecasts`);
        const result = await res.json();

        if (result.success) {
            getEl('kpi-week-forecast').innerText = `${result.next_7_days.toLocaleString()} EGP`;
            getEl('kpi-month-forecast').innerText = `${result.next_30_days.toLocaleString()} EGP`;
            getEl('kpi-year-forecast').innerText = `${result.next_year.toLocaleString()} EGP`;
            getEl('greeting-text').innerHTML = `Model Accuracy: ${result.accuracy}% | Data-driven future insights`;

            currentChartData = result.charts;
            renderCharts(currentChartData);
        }
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

// ===== RENDER CHARTS =====
function renderCharts(chartsData) {
    if (!chartsData) return;

    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const textColor = theme === 'dark' ? '#f1f5f9' : '#111827';
    const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0';

    // 1. Timeline Chart (Actual vs Predicted)
    if (timelineChartObj) timelineChartObj.destroy();
    const timelineOptions = {
        chart: { 
            type: 'area', 
            height: 380, 
            width: '100%', 
            foreColor: textColor, 
            toolbar: { show: false } // <-- إخفاء الأيقونات نهائياً
        },
        series: [
            { name: 'Actual Sales', data: chartsData.timeline.map(d => d.actual) },
            { name: 'AI Forecast', data: chartsData.timeline.map(d => d.predicted) }
        ],
        xaxis: { categories: chartsData.timeline.map(d => d.date) },
        yaxis: { labels: { formatter: (val) => val ? val.toLocaleString() + " EGP" : "0 EGP" } },
        colors: ['#64748b', '#2563eb'],
        stroke: { 
            curve: 'smooth', 
            width: [3, 3], 
            dashArray: [0, 5] 
        }, 
        fill: { 
            type: 'gradient', 
            gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 90, 100] } 
        },
        dataLabels: { enabled: false },
        tooltip: { theme: theme },
        grid: { borderColor: gridColor },
        legend: { 
            position: 'top', 
            horizontalAlign: 'right', // <-- نقل الدليل لليمين مكان الأيقونات
            offsetY: -10,
            offsetX: 0
        }
    };
    timelineChartObj = new ApexCharts(document.querySelector("#timeline-chart"), timelineOptions);
    timelineChartObj.render();

    // 2. Year-over-Year Chart
    if (yoyChartObj) yoyChartObj.destroy();
    const yoyOptions = {
        chart: { type: 'bar', height: 300, width: '100%', foreColor: textColor, toolbar: { show: false } },
        series: [
            { name: 'Last Year', data: chartsData.yoy.map(d => d.last_year) },
            { name: 'Current Year', data: chartsData.yoy.map(d => d.current_year) }
        ],
        xaxis: { categories: chartsData.yoy.map(d => d.month) },
        colors: ['#94a3b8', '#1d4ed8'],
        plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
        dataLabels: { enabled: false },
        tooltip: { theme: theme },
        grid: { borderColor: gridColor, strokeDashArray: 4 },
        legend: { position: 'top', horizontalAlign: 'right', offsetY: -10 }
    };
    yoyChartObj = new ApexCharts(document.querySelector("#yoy-chart"), yoyOptions);
    yoyChartObj.render();

    // 3. Weekly Average Chart
    if (weeklyChartObj) weeklyChartObj.destroy();
    const weeklyOptions = {
        chart: { type: 'bar', height: 300, width: '100%', foreColor: textColor, toolbar: { show: false } },
        series: [{ name: 'Avg Sales', data: chartsData.weekly.map(d => d.avg_sales) }],
        xaxis: { categories: chartsData.weekly.map(d => d.day) },
        colors: ['#3b82f6'],
        plotOptions: { bar: { borderRadius: 6, distributed: true } },
        dataLabels: { enabled: false },
        legend: { show: false },
        tooltip: { theme: theme },
        grid: { borderColor: gridColor, strokeDashArray: 4 }
    };
    weeklyChartObj = new ApexCharts(document.querySelector("#weekly-chart"), weeklyOptions);
    weeklyChartObj.render();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', fetchAIForecasts);