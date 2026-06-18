const API_BASE_URL = 'http://127.0.0.1:5000/api';
// الاعتماد على التوكن
const token = localStorage.getItem('jwtToken');
// بنحتفظ بالـ ID مؤقتاً
const customerId = localStorage.getItem('customerId') || localStorage.getItem('customer_id');

document.addEventListener('DOMContentLoaded', () => {
    setupNavbarAuth();
    fetchUserOrders();

    // تحديث البيانات كل 30 ثانية
    setInterval(() => {
        if(token) fetchUserOrders(); // نحدث بس لو اليوزر لسه مسجل دخول
    }, 30000);
});

// دالة مساعدة لتسجيل الخروج السريع
function logoutUser(event) {
    if (event) event.preventDefault(); 
    localStorage.removeItem("jwtToken"); 
    localStorage.removeItem("customerId");
    localStorage.removeItem("customer_id"); 
    localStorage.removeItem("diningMode");
    window.location.href = "../home/home.html";
}

function setupNavbarAuth() {
    const authLink = document.getElementById('auth-link');
    const authText = document.getElementById('auth-text');

    if (token) { // 🔴 الاعتماد على التوكن
        authText.innerText = "Profile";
        authLink.href = "../profile/profile.html"; 
    } else {
        authText.innerText = "Login";
        authLink.href = "../login/login.html"; 
    }
}

async function fetchUserOrders() {
    if (!token) { // 🔴 التحقق من التوكن
        console.log("User not logged in");
        const noMsg = document.getElementById('no-active-msg');
        noMsg.querySelector('p').innerText = "Please login to view your orders.";
        noMsg.classList.remove('hidden');
        document.getElementById('orders-container').innerHTML = '';
        return;
    }

    try {
        // 🔴 استخدام الرابط المؤمن وإرسال التوكن
        const response = await fetch(`${API_BASE_URL}/my-orders`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            alert("Your session has expired. Please login again.");
            logoutUser();
            return;
        }

        if (!response.ok) throw new Error('Failed to fetch');
        
        const allOrders = await response.json();
        
        // جلب بداية اليوم الحالي (الساعة 12 بالليل) عشان نقل الأوردرات للـ History
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0); 

        const activeOrders = allOrders.filter(o => {
            const status = o.status ? o.status.toLowerCase() : '';
            if (status === 'cancelled') return false; 
            
            const isCompleted = ['completed', 'done', 'delivered'].includes(status);
            const orderDate = new Date(o.ordered_at || o.timestamp); 
            
            if (isCompleted && orderDate.getTime() < todayMidnight.getTime()) {
                return false; 
            }
            return true; 
        });
        
        const historyOrders = allOrders.filter(o => {
            const status = o.status ? o.status.toLowerCase() : '';
            if (status === 'cancelled') return true; 
            
            const isCompleted = ['completed', 'done', 'delivered'].includes(status);
            const orderDate = new Date(o.ordered_at || o.timestamp);
            
            if (isCompleted && orderDate.getTime() < todayMidnight.getTime()) {
                return true; 
            }
            return false;
        });

        renderActiveOrders(activeOrders);
        renderHistory(historyOrders);

    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('active-view').classList.add('hidden');
    document.getElementById('history-view').classList.add('hidden');

    if (tab === 'active') {
        document.querySelector('.tab-btn:first-child').classList.add('active');
        document.getElementById('active-view').classList.remove('hidden');
    } else {
        document.querySelector('.tab-btn:last-child').classList.add('active');
        document.getElementById('history-view').classList.remove('hidden');
    }
}

function renderActiveOrders(orders) {
    const container = document.getElementById('orders-container');
    const noMsg = document.getElementById('no-active-msg');

    container.innerHTML = '';

    if (orders.length === 0) {
        noMsg.classList.remove('hidden');
        return;
    }

    noMsg.classList.add('hidden');
    
    orders.forEach(order => {
        container.insertAdjacentHTML('beforeend', createOrderCard(order));
    });
}

function createOrderCard(order) {
    const stat = order.status ? order.status.toLowerCase() : '';
    const priceDisplay = `$${order.totalPrice || order.total}`;
    const orderId = order.id || order.ORDER_ID;

    // 1. تجميع كل الاحتمالات الممكنة لاسم الحقل من الداتابيز
    const rawMode = order.mode || order.order_type || order.type || order.orderType || 'takeaway';
    
    // 2. تحويله لنص وتصغير الحروف ومسح المسافات
    const mode = String(rawMode).toLowerCase().trim();

    let typeText = 'Takeaway';
    let icon = 'fa-utensils';
    let destText = 'Pickup';

    // 3. استخدام includes بدل === عشان نضمن إنه يلقط الكلمة حتى لو معاها حروف تانية
    if (mode.includes('delivery')) {
        typeText = 'Home Delivery';
        icon = 'fa-motorcycle';
        destText = order.address ? order.address : 'Your Address';
    } else if (mode.includes('reservation')) {
        typeText = 'VIP Reservation';
        destText = order.tableNum ? `Table #${order.tableNum}` : 'Reserved Table';
    } else if (mode.includes('dine') || mode.includes('dine_in') || mode.includes('dine-in')) {
        typeText = 'Dine-in';
        destText = order.tableNum ? `Table #${order.tableNum}` : 'Inside Restaurant';
    }

    // === تغيير المسميات في واجهة العميل ===
    let displayStatus = order.status;
    if (stat === 'new' || stat === 'payment') displayStatus = 'New'; 
    if (stat === 'confirmed' || stat === 'preparing') displayStatus = 'Preparing';
    if (stat === 'ready') displayStatus = 'Ready'; 
    if (stat === 'completed' || stat === 'done') displayStatus = 'Completed';
    if (stat === 'delivered') displayStatus = 'Delivered';

    // تمرير الـ mode المتنظف
    let progressHTML = generateProgressBar(mode, stat);
    
    let cancelBtn = (stat === 'new' || stat === 'payment') ? 
        `<button class="btn-cancel" onclick="cancelOrder(${orderId})">Cancel Order</button>` : '';

    const timeString = new Date(order.ordered_at || order.timestamp).toLocaleTimeString();

    let expectedTimeHtml = '';
    if (displayStatus === 'Preparing' && order.expectedTime) {
        const expDate = new Date(order.expectedTime);
        const timeFormatted = expDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const now = new Date();
        const diffMs = expDate - now;
        const diffMins = Math.ceil(diffMs / 60000); 

        let waitText = '';
        if (diffMins > 0) {
            waitText = `In ~${diffMins} mins (${timeFormatted})`;
        } else {
            waitText = `Around ${timeFormatted}`;
        }

        expectedTimeHtml = `
            <p class="expected-time-badge">
                <i class="fa-solid fa-stopwatch"></i> <strong>Est. Ready:</strong> ${waitText}
            </p>`;
    }

    return `
    <div class="order-card" id="order-card-${orderId}">
        <div class="card-header-bar">
            <div class="order-meta">
                <div class="order-icon"><i class="fa-solid ${icon}"></i></div>
                <div class="order-id">
                    <h3>Order #${orderId}</h3>
                    <span>${typeText}</span>
                </div>
            </div>
            <div class="order-price-tag">${priceDisplay}</div>
        </div>

        <div class="card-body-content">
            <div class="info-grid">
                <p><i class="fa-regular fa-clock"></i> <strong>Time:</strong> ${timeString}</p>
                <p><i class="fa-solid fa-location-dot"></i> <strong>Dest:</strong> ${destText}</p>
                <p><i class="fa-solid fa-hourglass-half"></i> <strong>Status:</strong> ${displayStatus}</p>
                ${expectedTimeHtml} 
            </div>
            <div class="progress-container">
                ${progressHTML}
            </div>
        </div>

        <div class="card-footer-bar">
            <div class="status-text">
                <i class="fa-solid fa-bell-concierge"></i> Current Status: ${displayStatus}
            </div>
            ${cancelBtn}
        </div>
    </div>
    `;
}

// === التعديل الخاص بالـ Progress Bar ===
function generateProgressBar(mode, stat) {
    if (stat === 'payment') {
        stat = 'new';
    }

    let s1 = 'step'; // New
    let s2 = 'step'; // Preparing
    let s3 = 'step'; // Ready
    let s4 = 'step'; // Completed (للداين إن) / On Way (للدليفري)
    let s5 = 'step'; // Delivered (للدليفري فقط)

    if (stat === 'new') {
        s1 = 'step active';
    } 
    else if (['confirmed', 'preparing'].includes(stat)) {
        s1 = 'step completed';
        s2 = 'step active';
    } 
    else if (stat === 'ready') {
        s1 = 'step completed';
        s2 = 'step completed';
        s3 = 'step active';
    } 
    else if (['completed', 'done'].includes(stat)) {
        s1 = 'step completed';
        s2 = 'step completed';
        s3 = 'step completed';
        if (!mode.includes('delivery')) s4 = 'step completed'; 
    } 
    else if (['on way', 'delivered'].includes(stat)) {
        s1 = 'step completed';
        s2 = 'step completed';
        s3 = 'step completed';
    } 
    else {
        s1 = 'step active'; 
    }

    return `
        <div class="progress-line-bg"></div>
        <div class="progress-steps">
            <div class="p-step ${s1}"><div class="p-dot"><i class="fa-solid fa-file-invoice"></i></div><span class="p-label">New</span></div>
            <div class="p-step ${s2}"><div class="p-dot"><i class="fa-solid fa-fire-burner"></i></div><span class="p-label">Preparing</span></div>
            <div class="p-step ${s3}"><div class="p-dot"><i class="fa-solid fa-box"></i></div><span class="p-label">Ready</span></div>
            <div class="p-step ${s4}"><div class="p-dot"><i class="fa-solid fa-check-double"></i></div><span class="p-label">Completed</span></div>
        </div>`;
}

function renderHistory(orders) {
    const container = document.getElementById('history-container');
    const noMsg = document.getElementById('no-history-msg');

    container.innerHTML = '';

    if (orders.length === 0) {
        noMsg.classList.remove('hidden');
        return;
    }

    noMsg.classList.add('hidden');
    
    orders.forEach(order => {
        const stat = order.status ? order.status.toLowerCase() : '';
        const isCancelled = stat === 'cancelled';
        const color = isCancelled ? '#ef4444' : '#10b981';
        
        let displayStatus = order.status;
        if (stat === 'new' || stat === 'payment') displayStatus = 'New';
        if (stat === 'confirmed' || stat === 'preparing') displayStatus = 'Preparing';
        if (stat === 'ready') displayStatus = 'Ready';
        if (stat === 'completed' || stat === 'done') displayStatus = 'Completed';
        if (stat === 'delivered') displayStatus = 'Delivered';
        
        const orderId = order.id || order.ORDER_ID;
        const priceDisplay = `$${order.totalPrice || order.total}`;

        const html = `
        <div class="order-card" style="opacity:0.8; border-left: 5px solid ${color}">
            <div class="card-header-bar">
                <div class="order-id">
                    <h3>Order #${orderId}</h3>
                    <span>${new Date(order.ordered_at || order.timestamp).toLocaleDateString()} • ${new Date(order.ordered_at || order.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style="text-align:right">
                    <span style="font-weight:bold; color:#0b1d49; display:block">${priceDisplay}</span>
                    <span style="font-size:0.8rem; color:${color}">${displayStatus}</span>
                </div>
            </div>
        </div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

async function cancelOrder(orderId) {
    const isConfirmed = confirm(`Are you sure you want to cancel Order #${orderId}?`);
    if (!isConfirmed) return; 

    try {
        // 🔴 إضافة التوكن لطلب الإلغاء عشان الحماية
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            alert("Your session has expired. Please login again.");
            logoutUser();
            return;
        }

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to cancel the order');
        }

        alert(`Order #${orderId} has been cancelled successfully.`);
        fetchUserOrders();

    } catch (error) {
        console.error('Error cancelling order:', error);
        alert('An error occurred while cancelling the order: ' + error.message);
    }
}