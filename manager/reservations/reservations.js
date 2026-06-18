(function() {
    const manager = localStorage.getItem("manager");
    if (!manager) {
        window.location.href = "../login/login.html"; // تأكد من المسار الصحيح لصفحة اللوجن
    }
})();
const API = "http://127.0.0.1:5000/manager";
const getEl = (id) => document.getElementById(id);

let globalReservations = []; 
let currentSort = { column: null, direction: 'asc' };
let tablesData = [];

// ===== UI Elements & Sidebar Logic =====
const sidebar = document.getElementById('sidebar');
const sidebarArrow = document.getElementById('sidebar-arrow');
const mobileToggle = document.getElementById('mobile-sidebar-toggle');
const closeSidebarBtn = document.getElementById('close-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay'); 
const btnLogout = document.getElementById('btn-logout');
const themeToggle = document.getElementById('theme-toggle');
const tableModal = document.getElementById('table-modal');

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

// ===== LOAD TABLES & 3D BLOCKS =====
async function loadTables() {
    try {
        const res = await fetch(`${API}/tables`);
        tablesData = await res.json();
        renderTablesMap();
    } catch(err) { console.error("Tables Load Error:", err); }
}

function renderTablesMap() {
    const container = getEl('tables-map');
    if (!container) return;
    
    container.innerHTML = tablesData.map(t => {
        const now = new Date();
        const hasUpcoming = globalReservations.some(r => r.table_id === t.table_id && new Date(r.time) >= now && r.reservation_status !== 'Cancelled');
        
        return `
            <div class="table-block ${hasUpcoming ? 'has-reservations' : ''}" onclick="openTableDetails(${t.table_id}, '${t.name}')">
                <strong>${t.name}</strong>
                <small><i class="fa-solid fa-chair"></i> ${t.seats}</small>
            </div>
        `;
    }).join('');
}

// ===== MODAL LOGIC (TABLE DETAILS) =====
function openTableDetails(tableId, tableName) {
    getEl('modal-table-title').innerHTML = `<i class="fa-solid fa-utensils"></i> Table ${tableName} Bookings`;
    const listContainer = getEl('table-reservations-list');
    
    const now = new Date();
    const tableRes = globalReservations.filter(r => r.table_id === tableId && new Date(r.time) >= new Date(now.setHours(0,0,0,0)))
        .sort((a,b) => new Date(a.time) - new Date(b.time));

    if (tableRes.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted);">No upcoming reservations for this table.</div>`;
    } else {
        listContainer.innerHTML = tableRes.map(r => {
            const isCancelled = r.reservation_status === 'Cancelled';
            const resDate = new Date(r.time);
            const dateStr = resDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = resDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            const custName = r.customer_name || `Cust #${r.customer_id}`;
            
            return `
                <div class="res-card ${isCancelled ? 'cancelled-card' : ''}">
                    <div class="res-card-header">
                        <h4 style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-user"></i> ${custName}</h4>
                        <div class="time"><i class="fa-regular fa-calendar"></i> ${dateStr} - ${timeStr}</div>
                    </div>
                    <div class="res-card-body" style="grid-template-columns: 1fr; gap: 8px;">
                        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                            <span><i class="fa-solid fa-phone" style="color:var(--text-muted)"></i> <strong>${r.customer_phone || '-'}</strong></span>
                            <span><i class="fa-solid fa-envelope" style="color:var(--text-muted)"></i> <strong>${r.customer_email || '-'}</strong></span>
                        </div>
                        <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 5px;">
                            <span><i class="fa-solid fa-users" style="color:var(--text-muted)"></i> Guests: <strong>${r.guests}</strong></span>
                            <span><i class="fa-solid fa-clock-rotate-left" style="color:var(--text-muted)"></i> Booked: <strong>${new Date(r.created_at || r.time).toLocaleDateString()}</strong></span>
                        </div>
                        ${r.requests ? `<div><i class="fa-solid fa-bell-concierge" style="color:var(--text-muted)"></i> Notes: <strong>${r.requests}</strong></div>` : ''}
                    </div>
                    ${!isCancelled ? `
                        <div class="res-actions">
                            <button class="btn btn-danger btn-sm cancel-reservation" data-id="${r.reservation_id}">Cancel Booking</button>
                        </div>
                    ` : '<div class="res-actions"><span class="badge cancelled">Cancelled</span></div>'}
                </div>
            `;
        }).join('');
    }
    
    tableModal.style.display = 'flex';
}

document.querySelector('.close-modal')?.addEventListener('click', () => tableModal.style.display = 'none');
window.addEventListener('click', (e) => { if(e.target === tableModal) tableModal.style.display = 'none'; });

// ===== LOAD RESERVATIONS TABLE =====
async function loadReservations() {
    try {
        const range = getEl('res-range')?.value || 'today';
        const specDate = getEl('res-date')?.value || '';
        const history = getEl('res-history')?.value || 'upcoming';
        
        let url = `${API}/reservations?range=${range}&history=${history}`;
        if(specDate) url += `&date=${specDate}`;

        const res = await fetch(url);
        globalReservations = await res.json();
        
        renderTable(globalReservations);
        
        if(tablesData.length === 0) await loadTables();
        else renderTablesMap();

    } catch(err) { console.error("Reservation Load Error:", err); }
}

function renderTable(data) {
    const table = getEl('reservations-table');
    if (!table) return;

    table.querySelectorAll('.order-group, .no-data').forEach(el => el.remove());

    if (data && data.length > 0) {
        const rowsHTML = data.map(r => {
            const statusClass = (r.reservation_status || '').toLowerCase();
            const resDate = new Date(r.time);
            const formattedTime = resDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const custName = r.customer_name || `Cust #${r.customer_id}`;
            
            return `
                <tbody class="order-group">
                    <tr class="main-row" onclick="this.parentElement.classList.toggle('expanded')">
                        <td data-label="Res ID"><strong>#${r.reservation_id}</strong></td>
                        <td data-label="Customer"><strong>${custName}</strong></td>
                        <td data-label="Table"><strong>${r.table_name || 'T-'+r.table_id}</strong></td>
                        <td data-label="Time">${formattedTime}</td>
                        <td data-label="Guests">${r.guests} Persons</td>
                        <td data-label="Status"><span class="badge ${statusClass}">${r.reservation_status}</span></td>
                        <td class="action-cell" data-label=""><i class="fa-solid fa-chevron-down toggle-icon"></i></td>
                    </tr>
                    <tr class="details-row">
                        <td colspan="7">
                            <div class="expanded-details">
                                <div class="detail-item">
                                    <span>Customer Contact</span>
                                    <div><i class="fa-solid fa-phone" style="width: 15px; color: var(--text-muted)"></i> ${r.customer_phone || 'N/A'}</div>
                                    <div style="margin-top: 4px;"><i class="fa-solid fa-envelope" style="width: 15px; color: var(--text-muted)"></i> ${r.customer_email || 'N/A'}</div>
                                </div>
                                <div class="detail-item">
                                    <span>Booking Info</span>
                                    <div><strong>Created:</strong> ${new Date(r.created_at || r.time).toLocaleString()}</div>
                                    <div style="margin-top: 4px;"><strong>Notes:</strong> ${r.requests || 'None'}</div>
                                </div>
                                <div class="detail-item" style="display:flex; align-items:flex-end; grid-column: 1 / -1; justify-content: flex-end;">
                                    ${r.reservation_status !== 'Cancelled' 
                                        ? `<button class="btn btn-danger btn-sm cancel-reservation" data-id="${r.reservation_id}"><i class="fa-solid fa-ban"></i> Cancel Booking</button>` 
                                        : ''}
                                </div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            `;
        }).join('');
        
        table.insertAdjacentHTML('beforeend', rowsHTML);
    } else {
        table.insertAdjacentHTML('beforeend', `<tbody class="no-data"><tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">No reservations found for selected filters.</td></tr></tbody>`);
    }

    applySearchFilter();
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

        document.querySelectorAll('th.sortable').forEach(el => el.classList.remove('asc', 'desc'));
        th.classList.add(currentSort.direction);

        const sortedData = [...globalReservations].sort((a, b) => {
            let valA, valB;
            if (column === 'id') { valA = a.reservation_id; valB = b.reservation_id; } 
            else if (column === 'customer') { valA = (a.customer_name || '').toLowerCase(); valB = (b.customer_name || '').toLowerCase(); } 
            else if (column === 'table') { valA = a.table_name || ''; valB = b.table_name || ''; } 
            else if (column === 'time') { valA = new Date(a.time); valB = new Date(b.time); } 
            else if (column === 'guests') { valA = a.guests; valB = b.guests; }
            else if (column === 'status') { valA = a.reservation_status || ''; valB = b.reservation_status || ''; }

            if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        renderTable(sortedData);
    });
});

// ===== SEARCH FILTER LOGIC =====
const applySearchFilter = () => {
    const s = getEl('res-search')?.value.toLowerCase();
    document.querySelectorAll('.order-group').forEach(group => {
        const mainRow = group.querySelector('.main-row');
        if (!mainRow) return;
        // Search textContent includes main row + expanded details (so it searches email/phone automatically)
        const text = group.textContent.toLowerCase();
        group.style.display = text.includes(s) ? '' : 'none';
    });
};

getEl('res-search')?.addEventListener('input', applySearchFilter);

['res-range', 'res-history'].forEach(id => {
    getEl(id)?.addEventListener('change', () => {
        getEl('res-date').value = ''; 
        loadReservations();
    });
});
getEl('res-date')?.addEventListener('change', loadReservations);

// ===== GLOBAL CANCEL HANDLER =====
document.addEventListener('click', async (e) => {
    if (e.target.closest('.cancel-reservation')) {
        const btn = e.target.closest('.cancel-reservation');
        const id = btn.dataset.id;
        if (!confirm("Are you sure you want to cancel this reservation?")) return;
        
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
            const res = await fetch(`${API}/cancel-reservation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservation_id: id })
            });
            const data = await res.json();
            if(data.success) {
                if(tableModal.style.display === 'flex') {
                    const tableId = globalReservations.find(r => r.reservation_id == id)?.table_id;
                    const tableName = globalReservations.find(r => r.reservation_id == id)?.table_name;
                    await loadReservations(); 
                    if(tableId) openTableDetails(tableId, tableName); 
                } else {
                    await loadReservations();
                }
            } else {
                alert(data.message);
                btn.innerHTML = 'Cancel';
            }
        } catch(err) { console.error("Cancel Error:", err); btn.innerHTML = 'Cancel'; }
    }
});

// ===== INIT =====
document.addEventListener("DOMContentLoaded", loadReservations);