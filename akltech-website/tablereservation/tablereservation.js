let tables = []; 
const API_BASE_URL = 'http://127.0.0.1:5000/api';
// 🔴 سحب التوكن من المتصفح
const token = localStorage.getItem('jwtToken');

const floor = document.getElementById("restaurant-floor");
const detailsContent = document.getElementById("details-content");
const confirmBtn = document.getElementById("confirmBtn");
const statusIndicator = document.getElementById("status-indicator");
let selectedTableId = null;

// المتغيرات الجديدة للوقت والتاريخ
let globalResDate = '';
let globalResTime = '';
const mode = localStorage.getItem("diningMode");
const today = new Date().toISOString().split('T')[0];

// ================= INITIALIZE DATE/TIME PICKER =================
function initDateTimePicker() {
    const panelHeader = document.querySelector('.panel-header');
    let dateTimeHtml = '';

    if (mode === 'reservation') {
        dateTimeHtml = `
            <div id="global-datetime-picker" class="reservation-inputs" style="margin-top: 0; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <p style="color: var(--accent); font-weight: bold; font-size: 0.9rem; margin-bottom: 10px;"><i class="fa-solid fa-clock"></i> 1. Select Date & Time First</p>
                <div class="input-group" style="margin-bottom: 10px;">
                    <label><i class="fa-regular fa-calendar"></i> Date</label>
                    <input type="date" id="global-res-date" class="modern-input" min="${today}" required>
                </div>
                <div class="input-group">
                    <label><i class="fa-regular fa-clock"></i> Time</label>
                    <input type="time" id="global-res-time" class="modern-input" required>
                </div>
            </div>
        `;
    } else {
        dateTimeHtml = `
            <div id="global-datetime-picker" style="margin-bottom: 20px;">
                <div class="input-group" style="background: rgba(74, 222, 128, 0.1); padding: 12px; border-radius: 8px; border: 1px solid #4ade80; text-align: center;">
                    <label style="color: #4ade80; margin: 0; font-weight: bold; font-size: 0.95rem;">
                        <i class="fa-solid fa-bolt"></i> Booking for Right Now (Dine-In)
                    </label>
                </div>
            </div>
        `;
    }
    panelHeader.insertAdjacentHTML('afterend', dateTimeHtml);

    if (mode === 'reservation') {
        document.getElementById('global-res-date').addEventListener('change', handleDateTimeChange);
        document.getElementById('global-res-time').addEventListener('change', handleDateTimeChange);
    }
}

function handleDateTimeChange() {
    globalResDate = document.getElementById('global-res-date').value;
    globalResTime = document.getElementById('global-res-time').value;

    // تصفير الاختيار عند تغيير الوقت
    selectedTableId = null;
    detailsContent.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-hand-pointer"></i>
            <p>Hover and click on any available table to see details.</p>
        </div>
    `;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `Confirm Booking`;
    statusIndicator.innerText = "Select a Table";
    statusIndicator.style.color = "#94a3b8";

    // لو اختار الاثنين، نجلب الطاولات ونشوف مين متاح
    if (globalResDate && globalResTime) {
        fetchTables(globalResDate, globalResTime);
    }
}

// ================= FETCH DATA FROM BACKEND =================
async function fetchTables(date = null, time = null) {
    try {
        let url = `${API_BASE_URL}/tables`;
        // إرسال التاريخ والوقت للباك إند إذا وجدوا
        if (date && time) {
            url += `?date=${date}&time=${time}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        
        tables = await response.json();
        
        if (tables.length === 0) {
            floor.innerHTML = '<p style="color:white; text-align:center; margin-top:50px;">No tables found in the database.</p>';
            return;
        }
        
        renderTables();
    } catch (error) {
        console.error("Error fetching tables:", error);
        floor.innerHTML = '<p style="color:red; text-align:center; margin-top:50px;">Failed to load tables from server. Is Flask running?</p>';
    }
}

// ================= RENDER FUNCTIONS =================
function renderTables() {
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
        
        let width = table.seats <= 2 ? 65 : 90;
        let height = table.type === 'round' ? width : 65;

        tableEl.className = `table-3d ${table.type}`;
        
        // تلوين الطاولة بالأحمر إذا كانت محجوزة
        if (table.reserved) {
            tableEl.classList.add('reserved');
        }

        tableEl.style.left = table.x + "%";
        tableEl.style.top = table.y + "%";
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

        tableEl.onclick = () => {
            // التحقق قبل الاختيار
            if (mode === 'reservation' && (!globalResDate || !globalResTime)) {
                alert("Please select Date and Time first to see available tables.");
                return;
            }
            
            // تم إزالة المنع هنا للسماح للمستخدم برؤية تفاصيل الطاولة المحجوزة
            selectMyTable(table, tableEl);
        };

        floor.appendChild(tableEl);
    });
}

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
    
    // التحديد البصري (اللون الذهبي) للطاولات المتاحة فقط
    if (!table.reserved) {
        element.classList.add('selected');
    }
    
    selectedTableId = table.id;
    updatePanel(table);

    // تغيير حالة الزر السفلي
    if (table.reserved) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<i class="fa-solid fa-ban"></i> Table Unavailable`;
    } else {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `Confirm Table #${table.id}`;
    }
}

function updatePanel(table) {
    // إذا كانت الطاولة محجوزة، نعرض رسالة بوقت الإتاحة
    if (table.reserved) {
        statusIndicator.innerText = "Currently Booked";
        statusIndicator.style.color = "#ef4444"; 

        detailsContent.innerHTML = `
            <div class="detail-row" style="margin-bottom: 10px;">
                <span class="detail-label">Table Number</span>
                <div class="detail-value">#${table.id}</div>
            </div>
            <div class="detail-row" style="margin-bottom: 10px;">
                <span class="detail-label">Location</span>
                <div class="detail-value">${table.zone}</div>
            </div>
            
            <div class="reservation-inputs" style="border-top: none; padding-top: 0; margin-top: 15px;">
                <div class="input-group" style="background: rgba(239, 68, 68, 0.1); padding: 15px; border-radius: 8px; border: 1px solid #ef4444; text-align: center;">
                    <label style="color: #ef4444; margin: 0; font-weight: bold; font-size: 0.95rem;">
                        <i class="fa-solid fa-lock"></i> Reserved until ${table.available_after || "later"}
                    </label>
                    <p style="color: #fca5a5; font-size: 0.8rem; margin-top: 8px; line-height: 1.4;">
                        This table will be available after the indicated time. Please select another table or modify your booking time.
                    </p>
                </div>
            </div>
        `;
    } else {
        // لو الطاولة متاحة نعرض التفاصيل العادية
        statusIndicator.innerText = "Table Selected";
        statusIndicator.style.color = "#4ade80"; 

        detailsContent.innerHTML = `
            <div class="detail-row" style="margin-bottom: 10px;">
                <span class="detail-label">Table Number</span>
                <div class="detail-value">#${table.id}</div>
            </div>
            <div class="detail-row" style="margin-bottom: 10px;">
                <span class="detail-label">Location</span>
                <div class="detail-value">${table.zone}</div>
            </div>
            
            <div class="reservation-inputs" style="border-top: none; padding-top: 0; margin-top: 0;">
                <div class="input-group">
                    <label><i class="fa-solid fa-users"></i> Guests (Max: ${table.seats})</label>
                    <div class="number-control">
                        <button type="button" onclick="changePartySize(-1, ${table.seats})">-</button>
                        <input type="number" id="res-guests" value="1" min="1" max="${table.seats}" readonly>
                        <button type="button" onclick="changePartySize(1, ${table.seats})">+</button>
                    </div>
                </div>
            </div>
        `;
    }
}

window.changePartySize = function(change, maxSeats) {
    const input = document.getElementById('res-guests');
    let currentValue = parseInt(input.value);
    let newValue = currentValue + change;

    if (newValue >= 1 && newValue <= maxSeats) {
        input.value = newValue;
    }
};

function switchView(viewName) {
    const realContainer = document.getElementById('real-view-container');
    const planContainer = document.getElementById('plan-view-container');
    const buttons = document.querySelectorAll('.view-btn');

    if (viewName === 'real') {
        realContainer.classList.remove('hidden'); realContainer.classList.add('active');
        planContainer.classList.remove('active'); planContainer.classList.add('hidden');
        buttons[0].classList.add('active'); buttons[1].classList.remove('active');
        statusIndicator.innerText = "Exploring 3D View...";
        statusIndicator.style.color = "#94a3b8";
    } else {
        planContainer.classList.remove('hidden'); planContainer.classList.add('active');
        realContainer.classList.remove('active'); realContainer.classList.add('hidden');
        buttons[1].classList.add('active'); buttons[0].classList.remove('active');
        
        if (!selectedTableId) {
            statusIndicator.innerText = "Select a Table";
            statusIndicator.style.color = "#94a3b8";
        } else {
             // إعادة التقييم لو الطاولة محجوزة
             const table = tables.find(t => t.id === selectedTableId);
             if (table && table.reserved) {
                 statusIndicator.innerText = "Currently Booked";
                 statusIndicator.style.color = "#ef4444";
             } else {
                 statusIndicator.innerText = "Table Selected";
                 statusIndicator.style.color = "#4ade80";
             }
        }
    }
}

document.getElementById("backBtn").addEventListener("click", function() {
    window.location.href = "../product/menu.html";
});

// ================= التعديل الأساسي للتأمين =================
confirmBtn.addEventListener("click", async function() {
    if (!token) {
        alert("Please login first to reserve a table.");
        window.location.href = "../login/login.html";
        return;
    }

    if (selectedTableId) {
        let dateInput, timeInput;

        if (mode === 'reservation') {
            dateInput = globalResDate;
            timeInput = globalResTime;

            if (!dateInput || !timeInput) {
                alert("Please select both Date and Time for your reservation.");
                return;
            }
        } else {
            const now = new Date();
            dateInput = now.toISOString().split('T')[0]; 
            timeInput = now.toTimeString().substring(0, 5); 
        }

        const guestsInput = document.getElementById('res-guests')?.value;

        const originalBtnText = confirmBtn.innerHTML;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
        confirmBtn.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}/check_availability`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ 
                    table_id: selectedTableId, 
                    res_date: dateInput, 
                    res_time: timeInput 
                })
            });

            if (response.status === 401) {
                alert("Your session has expired. Please login again.");
                window.location.href = "../login/login.html";
                return;
            }

            const result = await response.json();

            if (!response.ok) {
                alert(result.error);
                confirmBtn.innerHTML = originalBtnText;
                confirmBtn.disabled = false;
                return;
            }

            const tableData = tables.find(t => t.id === selectedTableId);
            const completeReservationData = {
                ...tableData,
                resDate: dateInput,
                resTime: timeInput,
                partySize: guestsInput
            };

            localStorage.setItem('selectedTable', JSON.stringify(completeReservationData));
            window.location.href = "../checkout/checkout.html";

        } catch (error) {
            console.error("Error checking availability:", error);
            alert("An error occurred while checking table availability. Please make sure the server is running.");
            confirmBtn.innerHTML = originalBtnText;
            confirmBtn.disabled = false;
        }
    }
});

window.switchView = switchView;
initDateTimePicker(); // تهيئة خانات الوقت أولاً
fetchTables();
switchView('plan');