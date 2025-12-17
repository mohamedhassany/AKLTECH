document.addEventListener('DOMContentLoaded', () => {
    loadCheckoutData();
    setupPaymentMethods();
    updateBackLink();
});

let selectedTable = null;

function updateBackLink() {
    const mode = localStorage.getItem('diningMode') || 'dine_in';
    const backLink = document.getElementById('dynamic-back-link');

    if (backLink) {
        if (mode === 'dine_in' || mode === 'reservation' || mode === 'table') {
            backLink.href = '../tablereservation/tablereservation.html'; 
            backLink.innerHTML = '<i class="fa-solid fa-arrow-left"></i> <span>Back to Tables</span>';
        } else {
            backLink.href = '../product/menu.html';
            backLink.innerHTML = '<i class="fa-solid fa-arrow-left"></i> <span>Back to Menu</span>';
        }
    }
}

function loadCheckoutData() {
    const cart = JSON.parse(localStorage.getItem('cartItems')) || [];
    const mode = localStorage.getItem('diningMode') || 'dine_in'; 
    
    let tableData = null;
    try {
        tableData = JSON.parse(localStorage.getItem('selectedTable'));
    } catch (e) {
        tableData = localStorage.getItem('selectedTable');
    }

    const badge = document.getElementById('order-mode-badge');
    if(badge) badge.innerText = mode.replace('_', ' ').toUpperCase();

    const detailsContainer = document.getElementById('dynamic-order-details');
    if(detailsContainer) {
        detailsContainer.innerHTML = ''; 

        if (mode === 'reservation' || mode === 'dine_in' || mode === 'table') {
            if (tableData) {
                // استخراج رقم الطاولة بدقة
                let tNum = 'Any';
                let tLoc = '';
                
                if (typeof tableData === 'object' && tableData !== null) {
                    tNum = tableData.n || tableData.number || tableData.id || 'Any';
                    tLoc = tableData.loc || tableData.location || '';
                } else if (tableData) {
                    tNum = tableData;
                }
                
                selectedTable = tNum; 
                const locHTML = tLoc ? `<small>(${tLoc})</small>` : '';

                // === كود إظهار رقم الطاولة (واضح جداً) ===
                detailsContainer.innerHTML = `
                    <div class="detail-box">
                        <i class="fa-solid fa-chair"></i>
                        <span>Table <strong>#${tNum}</strong> ${locHTML}</span>
                    </div>
                `;
            } else {
                detailsContainer.innerHTML = `
                    <div style="color:red; background:#fee2e2; padding:10px; border-radius:8px;">
                        <i class="fa-solid fa-circle-exclamation"></i> No table selected. 
                        <a href="../tablereservation/tablereservation.html" style="color:#b91c1c; text-decoration:underline;">Select Table</a>
                    </div>`;
            }
        } else if (mode === 'delivery') {
            detailsContainer.innerHTML = `
                <div class="input-row">
                    <label style="font-size:0.85rem; font-weight:600; margin-bottom:5px; display:block;">Delivery Address</label>
                    <input type="text" id="address-field" class="modern-input" placeholder="Apartment, Street, Area...">
                </div>
            `;
        } else { // Takeaway
            detailsContainer.innerHTML = `
                <div class="detail-box">
                    <i class="fa-solid fa-bag-shopping"></i>
                    <span>Pickup from Counter</span>
                </div>
            `;
        }
    }

    // Items List
    const itemsList = document.getElementById('checkout-items-list');
    let subtotal = 0;
    if (itemsList) {
        if(cart.length === 0) {
            itemsList.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">Cart is empty</p>';
        } else {
            itemsList.innerHTML = '';
            cart.forEach(item => {
                subtotal += item.price * item.quantity;
                const itemHTML = `
                    <div class="checkout-item">
                        <div class="item-left">
                            <img src="${item.image}" alt="Food" onerror="this.src='placeholder.jpg'">
                            <div class="item-info">
                                <h4>${item.name}</h4>
                                <p>x${item.quantity}</p>
                            </div>
                        </div>
                        <div class="item-price">$${(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                `;
                itemsList.insertAdjacentHTML('beforeend', itemHTML);
            });
        }
    }

    // Calculations
    const tax = subtotal * 0.10;
    const total = subtotal + tax;

    if(document.getElementById('summ-subtotal')) document.getElementById('summ-subtotal').innerText = `$${subtotal.toFixed(2)}`;
    if(document.getElementById('summ-tax')) document.getElementById('summ-tax').innerText = `$${tax.toFixed(2)}`;
    if(document.getElementById('summ-total')) document.getElementById('summ-total').innerText = `$${total.toFixed(2)}`;
    if(document.getElementById('btn-total')) document.getElementById('btn-total').innerText = `$${total.toFixed(2)}`;
}

function setupPaymentMethods() {
    const radios = document.querySelectorAll('input[name="payment"]');
    const ccForm = document.getElementById('card-details-form');
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.querySelectorAll('.payment-card').forEach(c => c.classList.remove('selected'));
            e.target.closest('.payment-card').classList.add('selected');
            if (e.target.value === 'card') {
                ccForm.classList.add('show');
            } else {
                ccForm.classList.remove('show');
            }
        });
    });
}

function processPayment(buttonBtn) {
    const mode = localStorage.getItem('diningMode') || 'takeaway';

    if (mode === 'delivery') {
        const address = document.getElementById('address-field');
        if (!address || address.value.trim() === "") {
            address.style.borderColor = "red";
            address.focus();
            return;
        }
    }

    buttonBtn.classList.add('loading');

    const cart = JSON.parse(localStorage.getItem('cartItems')) || [];
    let subtotal = 0;
    cart.forEach(item => subtotal += (parseFloat(item.price) * parseInt(item.quantity)));
    const totalWithTax = (subtotal + (subtotal * 0.10)).toFixed(2);

    setTimeout(() => {
        let tableNum = null;
        if (mode === 'dine_in' || mode === 'reservation' || mode === 'table') {
            const rawTableData = localStorage.getItem('selectedTable');
            if (rawTableData && rawTableData !== "undefined" && rawTableData !== "null") {
                try {
                    const parsedData = JSON.parse(rawTableData);
                    if (typeof parsedData === 'object') {
                        tableNum = parsedData.n || parsedData.number || parsedData.id || null;
                    } else {
                        tableNum = parsedData;
                    }
                } catch (e) {
                    tableNum = rawTableData;
                }
            }
        }

        const addressInput = document.getElementById('address-field');
        const address = addressInput ? addressInput.value : '';

        const driverNames = ['Ahmed Mohamed', 'Karim Ali', 'Sameh Hassan', 'Mahmoud Saeed', 'Omar Khaled'];
        const randomDriver = driverNames[Math.floor(Math.random() * driverNames.length)];
        const prefixes = ['010', '011', '012', '015'];
        const randomPhone = prefixes[Math.floor(Math.random() * prefixes.length)] + Math.floor(10000000 + Math.random() * 90000000); 
        const estimatedTime = Math.floor(15 + Math.random() * 20) + ' - ' + Math.floor(40 + Math.random() * 10) + ' mins';

        const newOrder = {
            id: Date.now().toString().slice(-6),
            mode: mode,
            tableNum: tableNum, 
            address: address,
            timestamp: new Date().getTime(),
            driver: randomDriver,
            phone: randomPhone,
            estTime: estimatedTime,
            totalPrice: totalWithTax 
        };

        let allOrders = JSON.parse(localStorage.getItem('allOrders')) || [];
        allOrders.push(newOrder);
        localStorage.setItem('allOrders', JSON.stringify(allOrders));
        localStorage.setItem('lastOrderDate', new Date().toLocaleDateString());

        localStorage.removeItem('cartItems');
        window.location.href = '../tracking/tracking.html'; 

    }, 1500);
}