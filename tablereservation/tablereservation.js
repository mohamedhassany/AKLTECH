// ================= DATA CONFIGURATION (بياناتك القديمة كما هي) =================
const tables = [
    { id: 1, seats: 2, type: 'round', x: 12, y: 15, reserved: false, zone: "Main Hall" },
    { id: 2, seats: 2, type: 'round', x: 28, y: 15, reserved: false, zone: "Main Hall" },
    { id: 3, seats: 2, type: 'round', x: 44, y: 15, reserved: false, zone: "Main Hall" },

    { id: 4, seats: 4, type: 'rect', x: 18, y: 40, reserved: false, zone: "Main Hall" },
    { id: 5, seats: 4, type: 'rect', x: 38, y: 40, reserved: false, zone: "Main Hall" },

    { id: 6, seats: 2, type: 'round', x: 75, y: 55, reserved: false, zone: "Window View" },
    
    { id: 7, seats: 4, type: 'rect', x: 73.5, y: 72, reserved: false, zone: "VIP Section" }, 
    
    { id: 8, seats: 2, type: 'round', x: 75, y: 89, reserved: false, zone: "Window View" }
];

const floor = document.getElementById("restaurant-floor");
const detailsContent = document.getElementById("details-content");
const confirmBtn = document.getElementById("confirmBtn");
const statusIndicator = document.getElementById("status-indicator");
let selectedTableId = null;

// ================= RENDER FUNCTIONS =================

function renderTables() {
    // إعادة الديكور القديم
    floor.innerHTML = `
        <div class="floor-zone zone-top-right"></div>
        <div class="floor-zone zone-bottom-left"></div>
        <div class="buffet-block" style="top: 10%; right: 5%; width: 60px; height: 100px; transform: translateZ(10px);"></div>
        <div class="buffet-block" style="top: 2%; right: 0; width: 180px; height: 30px; transform: translateZ(10px);"></div>
        <div class="buffet-block" style="top: 2%; right: 0; width: 30px; height: 100px; transform: translateZ(10px);"></div>
        <div class="buffet-block" style="bottom: 15%; left: 15%; width: 80px; height: 140px; transform: translateZ(10px);"></div>
        <div class="buffet-block" style="bottom: 5%; left: 0; width: 30px; height: 250px; transform: translateZ(10px);"></div>
        <div class="entrance-mat"></div>
        <div class="entrance-gate"></div>
    `;

    tables.forEach(table => {
        const tableEl = document.createElement("div");
        
        // أحجامك القديمة
        let width = table.seats <= 2 ? 65 : 90;
        let height = table.type === 'round' ? width : 65;
        
        // *تحويل البكسل لنسبة مئوية تقريبية للحفاظ على التجاوب*
        // بما أن العرض القديم 800، سنستخدمه كمرجع نسبي
        let widthPercent = (width / 800) * 100;
        let heightPercent = (height / 700) * 100; // الارتفاع القديم كان 700

        tableEl.className = `table-3d ${table.type} ${table.reserved ? 'reserved' : ''}`;
        tableEl.style.left = table.x + "%";
        tableEl.style.top = table.y + "%";
        // نستخدم البكسل هنا كما في كودك الأصلي للحفاظ على شكل الطاولة، لكن الموقع بالنسبة المئوية
        tableEl.style.width = width + "px"; 
        tableEl.style.height = height + "px";
        
        tableEl.innerHTML = `
            <div class="t-top">
                <span class="table-num">${table.id}</span>
                <span class="seat-count">${table.seats} Chairs</span>
            </div>
            <div class="t-side"></div>
            ${renderChairs(table.seats, width, height, table.type)}
        `;

        if (!table.reserved) {
            tableEl.onclick = () => selectMyTable(table, tableEl);
        }

        floor.appendChild(tableEl);
    });
}

// دالة الكراسي القديمة (بدون تغيير)
function renderChairs(count, w, h, type) {
    let chairsHTML = '';
    const zOffset = "-5px";
    
    if (type === 'rect') {
        chairsHTML += `<div class="chair" style="top: -15px; left: 50%; transform:translateZ(${zOffset}) translateX(-50%);"></div>`; 
        chairsHTML += `<div class="chair" style="bottom: -15px; left: 50%; transform:translateZ(${zOffset}) translateX(-50%);"></div>`; 
        
        if(count >= 4) {
             chairsHTML += `<div class="chair" style="top: 50%; left: -15px; transform:translateZ(${zOffset}) translateY(-50%);"></div>`; 
             chairsHTML += `<div class="chair" style="top: 50%; right: -15px; transform:translateZ(${zOffset}) translateY(-50%);"></div>`; 
        }
    } else {
        chairsHTML += `<div class="chair" style="top: -15px; left: 50%; transform:translateZ(${zOffset}) translateX(-50%);"></div>`;
        chairsHTML += `<div class="chair" style="bottom: -15px; left: 50%; transform:translateZ(${zOffset}) translateX(-50%);"></div>`;
    }
    return chairsHTML;
}

// ================= INTERACTION FUNCTIONS =================

function selectMyTable(table, element) {
    document.querySelectorAll('.table-3d').forEach(t => t.classList.remove('selected'));
    element.classList.add('selected');
    selectedTableId = table.id;

    updatePanel(table);
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = `Confirm Table #${table.id}`;
}

function updatePanel(table) {
    statusIndicator.innerText = "Table Selected";
    statusIndicator.style.color = "#4ade80";

    detailsContent.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Table Number</span>
            <div class="detail-value">#${table.id}</div>
        </div>
        <div class="detail-row">
            <span class="detail-label">Capacity</span>
            <div class="detail-value">${table.seats} Persons <i class="fa-solid fa-user-group" style="font-size:0.8rem"></i></div>
        </div>
        <div class="detail-row">
            <span class="detail-label">Location</span>
            <div class="detail-value">${table.zone}</div>
        </div>
    `;
}

function switchView(viewName) {
    const realContainer = document.getElementById('real-view-container');
    const planContainer = document.getElementById('plan-view-container');
    const buttons = document.querySelectorAll('.view-btn');

    if (viewName === 'real') {
        realContainer.classList.remove('hidden'); realContainer.classList.add('active');
        planContainer.classList.remove('active'); planContainer.classList.add('hidden');
        buttons[0].classList.add('active'); buttons[1].classList.remove('active');
        statusIndicator.innerText = "Exploring 3D View...";
    } else {
        planContainer.classList.remove('hidden'); planContainer.classList.add('active');
        realContainer.classList.remove('active'); realContainer.classList.add('hidden');
        buttons[1].classList.add('active'); buttons[0].classList.remove('active');
        
        if (!selectedTableId) {
            statusIndicator.innerText = "Select a Table";
            statusIndicator.style.color = "#94a3b8";
        } else {
            statusIndicator.innerText = "Table Selected";
            statusIndicator.style.color = "#4ade80";
        }
    }
}

document.getElementById("backBtn").addEventListener("click", function() {
    window.location.href = "../product/menu.html";
});

confirmBtn.addEventListener("click", function() {
    if (selectedTableId) {
        const tableData = tables.find(t => t.id === selectedTableId);
        localStorage.setItem('selectedTable', JSON.stringify(tableData));
        window.location.href = "../checkout/checkout.html";
    }
});

window.switchView = switchView;
renderTables();
switchView('plan');