(function() {
    const manager = localStorage.getItem("manager");
    if (!manager) {
        window.location.href = "../login/login.html"; // تأكد من المسار الصحيح لصفحة اللوجن
    }
})();
const API = "http://127.0.0.1:5000/manager";
const getEl = (id) => document.getElementById(id);

let globalOrders = []; // للاحتفاظ بالبيانات للترتيب والفلترة
let currentSort = { column: null, direction: 'asc' };

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
        if(theme === 'light') {
            themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
        } else {
            themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
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

// ===== API Integration: Load Orders =====
async function loadOrdersPerformance() {
    try {
        const filter = getEl("orderFilter")?.value || "today";
        const res = await fetch(`${API}/orders-performance?filter=${filter}`);
        const data = await res.json();
        
        // Update KPIs
       if (data.kpis) {

    const activeEl = getEl('kpi-active');
    const cancelEl = getEl('kpi-cancelled');

    if(activeEl) activeEl.textContent = data.kpis.active_orders;
    if(cancelEl) cancelEl.textContent = data.kpis.cancelled_today;

}

        globalOrders = data.orders || [];
        renderTable(globalOrders);
        
    } catch(err) { 
        console.error("Orders Error:", err); 
        const table = getEl('orders-table');
        if (table) {
            table.querySelectorAll('.order-group, .no-data').forEach(el => el.remove());
            table.insertAdjacentHTML('beforeend', `<tbody class="no-data"><tr><td colspan="6" style="text-align: center; color: var(--danger);">Failed to load data. Please check connection.</td></tr></tbody>`);
        }
    }
}

// ===== Render Table Content =====
function renderTable(ordersData) {
    const table = getEl('orders-table');
    if (!table) return;

    // Clean previous data
    table.querySelectorAll('.order-group, .no-data').forEach(el => el.remove());

    if (ordersData && ordersData.length > 0) {
        const rowsHTML = ordersData.map(o => {
            const prep = (o.updated_at && o.ordered_at) ? Math.floor((new Date(o.updated_at) - new Date(o.ordered_at)) / 60000) : 0;
            const statusClass = (o.status || '').toLowerCase().replace(' ', '-');
            
            return `
                <tbody class="order-group">
                    <tr class="main-row" onclick="this.parentElement.classList.toggle('expanded')">
                        <td data-label="Order ID"><strong>#${o.ORDER_ID}</strong></td>
                        <td data-label="Type">${o.type || '-'}</td>
                        <td data-label="Status"><span class="badge ${statusClass}">${o.status}</span></td>
                        <td data-label="Total"><strong>$${parseFloat(o.total).toFixed(2)}</strong></td>
                        <td data-label="Prep Time">${prep > 0 ? prep + ' min' : '-'}</td>
                        <td class="action-cell" data-label=""><i class="fa-solid fa-chevron-down toggle-icon"></i></td>
                    </tr>
                    <tr class="details-row">
                        <td colspan="6">
                            <div class="expanded-details">
                                <div class="detail-item">
                                    <span>Order Items</span>
                                    ${o.items || 'No items listed'}
                                </div>
                                <div class="detail-item">
                                    <span>Notes / Special Requests</span>
                                    ${o.notes || 'None'}
                                </div>
                                <div class="detail-item">
                                    <span>Cashier</span>
                                    ${o.cashier_name || '-'}
                                </div>
                                <div class="detail-item">
                                    <span>Table / Location</span>
                                    ${o.name_or_number || '-'}
                                </div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            `;
        }).join('');
        
        table.insertAdjacentHTML('beforeend', rowsHTML);
    } else {
        table.insertAdjacentHTML('beforeend', `<tbody class="no-data"><tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">No orders found for this period.</td></tr></tbody>`);
    }

    // Re-apply filter after rendering
    filterOrders();
}

// ===== SORTING LOGIC =====
document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const column = th.dataset.sort;
        
        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'asc';
        }

        // Update Icons
        document.querySelectorAll('th.sortable').forEach(el => el.classList.remove('asc', 'desc'));
        th.classList.add(currentSort.direction);

        // Sort Data
        const sortedData = [...globalOrders].sort((a, b) => {
            let valA, valB;
            
            if (column === 'id') { 
                valA = a.ORDER_ID; valB = b.ORDER_ID; 
            } else if (column === 'type') { 
                valA = a.type || ''; valB = b.type || ''; 
            } else if (column === 'status') { 
                valA = a.status || ''; valB = b.status || ''; 
            } else if (column === 'total') { 
                valA = parseFloat(a.total) || 0; valB = parseFloat(b.total) || 0; 
            } else if (column === 'prep') {
                valA = (a.updated_at && a.ordered_at) ? Math.floor((new Date(a.updated_at) - new Date(a.ordered_at)) / 60000) : 0;
                valB = (b.updated_at && b.ordered_at) ? Math.floor((new Date(b.updated_at) - new Date(b.ordered_at)) / 60000) : 0;
            }

            if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        renderTable(sortedData);
    });
});

// ===== Search & Filter Logic =====
const filterOrders = () => {
    const s = getEl('orders-search')?.value.toLowerCase();
    const f = getEl('orders-filter')?.value.toLowerCase();
    
    document.querySelectorAll('.order-group').forEach(group => {
        const mainRow = group.querySelector('.main-row');
        if (!mainRow) return;

        const id = mainRow.cells[0].textContent.toLowerCase();
        const type = mainRow.cells[1].textContent.toLowerCase();
        const detailsText = group.querySelector('.expanded-details').textContent.toLowerCase();
        
        const matchesSearch = id.includes(s) || detailsText.includes(s);
        const matchesType = !f || type.replace('-', '_') === f;
        
        group.style.display = matchesSearch && matchesType ? '' : 'none';
    });
};

[getEl('orders-search'), getEl('orders-filter')].forEach(el => el?.addEventListener('input', filterOrders));
getEl("orderFilter")?.addEventListener("change", loadOrdersPerformance);

// ===== Init =====
document.addEventListener("DOMContentLoaded", loadOrdersPerformance);