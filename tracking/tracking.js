document.addEventListener('DOMContentLoaded', () => {
    checkAndArchiveOrders();
    renderActiveOrders();
    renderHistory();
    
    // Refresh timers every 30s
    setInterval(() => {
        checkAndArchiveOrders();
        renderActiveOrders();
    }, 30000);
});

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
        renderHistory();
    }
}

function checkAndArchiveOrders() {
    let activeOrders = JSON.parse(localStorage.getItem('allOrders')) || [];
    let historyOrders = JSON.parse(localStorage.getItem('orderHistory')) || [];
    let updatedActive = [];
    let hasChanges = false;
    const NOW = Date.now();
    const ARCHIVE_TIME = 15000 + 300000; // 15s delivery + 5 min wait

    activeOrders.forEach(order => {
        if ((NOW - order.timestamp) > ARCHIVE_TIME) {
            order.finalStatus = 'Delivered';
            historyOrders.push(order);
            hasChanges = true;
        } else {
            updatedActive.push(order);
        }
    });

    if (hasChanges) {
        localStorage.setItem('allOrders', JSON.stringify(updatedActive));
        localStorage.setItem('orderHistory', JSON.stringify(historyOrders));
    }
}

function renderActiveOrders() {
    const orders = JSON.parse(localStorage.getItem('allOrders')) || [];
    const container = document.getElementById('orders-container');
    const noMsg = document.getElementById('no-active-msg');

    if (orders.length === 0) {
        container.innerHTML = '';
        noMsg.classList.remove('hidden');
        return;
    }

    noMsg.classList.add('hidden');
    container.innerHTML = '';

    orders.slice().reverse().forEach(order => {
        container.insertAdjacentHTML('beforeend', createOrderCard(order));
    });
}

function createOrderCard(order) {
    const diff = Date.now() - order.timestamp;
    const isReady = diff > 5000;
    const isDelivered = diff > 15000;
    const priceDisplay = order.totalPrice ? `$${order.totalPrice}` : 'PAID';

    let typeText = order.mode === 'delivery' ? 'Home Delivery' : (order.mode === 'dine_in' ? 'Dine-in' : 'Takeaway');
    let icon = order.mode === 'delivery' ? 'fa-motorcycle' : 'fa-utensils';
    let destText = order.address || (order.tableNum ? `Table #${order.tableNum}` : 'Pickup');
    
    let progressHTML = generateProgressBar(order.mode, isReady, isDelivered);
    let cancelBtn = !isReady ? `<button class="btn-cancel" onclick="cancelOrder('${order.id}')">Cancel Order</button>` : '';

    return `
    <div class="order-card">
        <div class="card-header-bar">
            <div class="order-meta">
                <div class="order-icon"><i class="fa-solid ${icon}"></i></div>
                <div class="order-id">
                    <h3>Order #${order.id}</h3>
                    <span>${typeText}</span>
                </div>
            </div>
            <div class="order-price-tag">${priceDisplay}</div>
        </div>

        <div class="card-body-content">
            <div class="info-grid">
                <p><i class="fa-regular fa-clock"></i> <strong>Time:</strong> ${new Date(order.timestamp).toLocaleTimeString()}</p>
                <p><i class="fa-solid fa-location-dot"></i> <strong>Dest:</strong> ${destText}</p>
                <p><i class="fa-solid fa-hourglass-half"></i> <strong>Est:</strong> ${order.estTime || '15 min'}</p>
            </div>
            <div class="progress-container">
                ${progressHTML}
            </div>
        </div>

        <div class="card-footer-bar">
            <div class="status-text">
                ${isDelivered ? '<i class="fa-solid fa-circle-check"></i> Order Processed' : (isReady ? '<i class="fa-solid fa-bell-concierge"></i> Ready to Serve/Pickup' : '<i class="fa-solid fa-fire"></i> Preparing...')}
            </div>
            ${cancelBtn}
        </div>
    </div>
    `;
}

function generateProgressBar(mode, isReady, isDelivered) {
    let s2 = isReady ? 'step completed' : 'step active';
    let s3 = isReady ? 'step active' : 'step';
    
    if (mode === 'delivery') {
         let s3_del = isDelivered ? 'step completed' : (isReady ? 'step active' : 'step');
         let s4 = isDelivered ? 'step active' : 'step';
         return `
            <div class="progress-line-bg"></div>
            <div class="progress-steps">
                <div class="p-step step completed"><div class="p-dot"><i class="fa-solid fa-check"></i></div><span class="p-label">Confirmed</span></div>
                <div class="p-step ${s2}"><div class="p-dot"><i class="fa-solid fa-fire-burner"></i></div><span class="p-label">Cooking</span></div>
                <div class="p-step ${s3_del}"><div class="p-dot"><i class="fa-solid fa-motorcycle"></i></div><span class="p-label">On Way</span></div>
                <div class="p-step ${s4}"><div class="p-dot"><i class="fa-solid fa-house"></i></div><span class="p-label">Delivered</span></div>
            </div>`;
    }

    return `
            <div class="progress-line-bg"></div>
            <div class="progress-steps">
                <div class="p-step step completed"><div class="p-dot"><i class="fa-solid fa-check"></i></div><span class="p-label">Confirmed</span></div>
                <div class="p-step ${s2}"><div class="p-dot"><i class="fa-solid fa-fire-burner"></i></div><span class="p-label">Cooking</span></div>
                <div class="p-step ${s3}"><div class="p-dot"><i class="fa-solid fa-bell-concierge"></i></div><span class="p-label">Ready</span></div>
            </div>`;
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem('orderHistory')) || [];
    const container = document.getElementById('history-container');
    const noMsg = document.getElementById('no-history-msg');

    if (history.length === 0) {
        container.innerHTML = '';
        noMsg.classList.remove('hidden');
        return;
    }

    noMsg.classList.add('hidden');
    container.innerHTML = '';
    
    history.sort((a, b) => b.timestamp - a.timestamp);

    history.forEach(order => {
        const price = order.totalPrice ? `$${order.totalPrice}` : 'Paid';
        const statusClass = order.status === 'Cancelled' ? 'cancelled' : 'delivered';
        const statusText = order.status === 'Cancelled' ? 'Cancelled' : 'Delivered';

        const html = `
        <div class="order-card" style="opacity:0.8; border-left: 5px solid ${order.status === 'Cancelled' ? '#ef4444' : '#10b981'}">
            <div class="card-header-bar">
                <div class="order-id">
                    <h3>Order #${order.id}</h3>
                    <span>${new Date(order.timestamp).toLocaleDateString()} • ${new Date(order.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style="text-align:right">
                     <span style="font-weight:bold; color:#0b1d49; display:block">${price}</span>
                     <span style="font-size:0.8rem; color:${order.status === 'Cancelled' ? 'red' : 'green'}">${statusText}</span>
                </div>
            </div>
        </div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function cancelOrder(id) {
    if (confirm("Cancel this order?")) {
        let active = JSON.parse(localStorage.getItem('allOrders')) || [];
        let history = JSON.parse(localStorage.getItem('orderHistory')) || [];
        const index = active.findIndex(o => o.id === id);
        if (index > -1) {
            let order = active[index];
            order.status = 'Cancelled';
            history.push(order);
            active.splice(index, 1);
            localStorage.setItem('allOrders', JSON.stringify(active));
            localStorage.setItem('orderHistory', JSON.stringify(history));
            renderActiveOrders();
        }
    }
}