const API_BASE_URL = 'https://mohassanyabd-akltech-api.hf.space/api';

document.addEventListener('DOMContentLoaded', () => {
    loadCheckoutData();
    setupPaymentMethods();
    updateBackLink();
});

let selectedTable = null;

// ==========================================
// 🔴 إضافة أمنية: تنظيف المدخلات لمنع الـ XSS
// ==========================================
function escapeHTML(str) {
    if (!str) return str;
    return str.replace(/[&<>'"]/g, function(tag) {
        const charsToReplace = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
        return charsToReplace[tag] || tag;
    });
}

// ==========================================
// 🌟 دالة جديدة: عرض الخطأ على الحقل مباشرة 
// ==========================================
function showError(element, message) {
    if (!element) {
        alert(message); // بديل احتياطي لو العنصر مش موجود
        return;
    }
    // تعيين رسالة الخطأ
    element.setCustomValidity(message);
    // إظهار الرسالة للمستخدم
    element.reportValidity();
    
    // بمجرد ما المستخدم يضغط أو يكتب، نشيل رسالة الخطأ
    const clearError = () => {
        element.setCustomValidity('');
        element.removeEventListener('input', clearError);
        element.removeEventListener('click', clearError);
    };
    element.addEventListener('input', clearError);
    element.addEventListener('click', clearError);
}

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

async function loadCheckoutData() {
    const cart = JSON.parse(localStorage.getItem('cartItems')) || [];
    const mode = localStorage.getItem('diningMode') || 'dine_in'; 
    
    // 🔴 الاعتماد على التوكن
    const token = localStorage.getItem('jwtToken');

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

                let resInfoHTML = '';
                if (tableData.resDate && tableData.resTime) {
                    resInfoHTML = `<div style="margin-top: 8px; font-size: 0.85rem; color: #94a3b8;">
                        <i class="fa-regular fa-calendar"></i> ${tableData.resDate} at ${tableData.resTime} <br>
                        <i class="fa-solid fa-users"></i> ${tableData.partySize} Guests
                    </div>`;
                }

                detailsContainer.innerHTML = `
                    <div class="detail-box" style="flex-direction: column; align-items: flex-start;">
                        <div>
                            <i class="fa-solid fa-chair"></i>
                            <span>Table <strong>#${tNum}</strong> ${locHTML}</span>
                        </div>
                        ${resInfoHTML}
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
                    <input type="text" id="address-field" class="modern-input" placeholder="Apartment, Street, Area..." value="Loading saved address...">
                </div>
            `;

            if (token) {
                try {
                    // 🔴 استخدام الـ API المؤمن بالتوكن لجلب البروفايل
                    const res = await fetch(`${API_BASE_URL}/profile`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if(res.ok) {
                        const data = await res.json();
                        const addrField = document.getElementById('address-field');
                        if (addrField) {
                            if (data.user && data.user.ADDRESS) {
                                addrField.value = data.user.ADDRESS;
                            } else {
                                addrField.value = '';
                            }
                        }
                    } else {
                        throw new Error('Unauthorized');
                    }
                } catch (err) {
                    console.error("Error fetching address:", err);
                    const addrField = document.getElementById('address-field');
                    if(addrField) addrField.value = '';
                }
            } else {
                const addrField = document.getElementById('address-field');
                if(addrField) addrField.value = '';
            }

        } else { 
            detailsContainer.innerHTML = `
                <div class="detail-box">
                    <i class="fa-solid fa-bag-shopping"></i>
                    <span>Pickup from Counter</span>
                </div>
            `;
        }
    }

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
                                <h4>${escapeHTML(item.name)}</h4>
                                <p>x${item.quantity}</p>
                            </div>
                        </div>
                        <div class="item-price">E£${(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                `;
                itemsList.insertAdjacentHTML('beforeend', itemHTML);
            });
        }
    }

    const tax = subtotal * 0.10;
    const total = subtotal + tax;

    if(document.getElementById('summ-subtotal')) document.getElementById('summ-subtotal').innerText = `E£${subtotal.toFixed(2)}`;
    if(document.getElementById('summ-tax')) document.getElementById('summ-tax').innerText = `E£${tax.toFixed(2)}`;
    if(document.getElementById('summ-total')) document.getElementById('summ-total').innerText = `E£${total.toFixed(2)}`;
    if(document.getElementById('btn-total')) document.getElementById('btn-total').innerText = `E£${total.toFixed(2)}`;
}

function setupPaymentMethods() {
    const radios = document.querySelectorAll('input[name="payment"]');
    const ccForm = document.getElementById('card-details-form');
    
    if(radios.length > 0 && ccForm) {
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
}

async function processPayment(buttonBtn) {
    const mode = localStorage.getItem('diningMode') || 'take_away'; 
    let deliveryAddress = null; 

    // 🔴 التحقق من تسجيل الدخول للطلبات المهمة
    const token = localStorage.getItem('jwtToken');
    const customerId = localStorage.getItem('customer_id');

    if ((mode === 'delivery' || mode === 'reservation') && !token) {
        alert("You must be logged in to make a delivery or reservation order.");
        window.location.href = "../login/login.html";
        return;
    }

    if (mode === 'delivery') {
        const addressInput = document.getElementById('address-field');
        if (!addressInput || addressInput.value.trim() === "" || addressInput.value === "Loading saved address...") {
            showError(addressInput, "Please provide a valid delivery address.");
            return;
        }
        deliveryAddress = escapeHTML(addressInput.value.trim()); 
    }

    const cart = JSON.parse(localStorage.getItem('cartItems')) || [];
    if (cart.length === 0) {
        alert("Cart is empty! Add food first.");
        window.location.href = "../product/menu.html";
        return;
    }

    let resDate = null;
    let resTime = null;
    let partySize = null;

    try {
        const tableData = JSON.parse(localStorage.getItem('selectedTable'));
        if (tableData && tableData.resDate) {
            resDate = escapeHTML(tableData.resDate);
            resTime = escapeHTML(tableData.resTime);
            partySize = escapeHTML(String(tableData.partySize));
        }
    } catch (e) {
        console.error("Error parsing reservation data:", e);
    }

    let subtotal = 0;
    cart.forEach(item => subtotal += (parseFloat(item.price) * parseInt(item.quantity)));
    const tax = subtotal * 0.10;
    const totalWithTax = (subtotal + tax).toFixed(2);

    const paymentMethodObj = document.querySelector('input[name="payment"]:checked');
    const paymentMethod = paymentMethodObj ? paymentMethodObj.value : 'cash';

    // ==========================================
    // 🔴 Validation لبيانات الكارت بالشكل الجديد
    // ==========================================
    if (paymentMethod === 'card') {
        const cardNumberInput = document.getElementById('card-number');
        const cardExpiryInput = document.getElementById('card-expiry');
        const cardCvvInput = document.getElementById('card-cvv');

        const cardNumber = cardNumberInput?.value.replace(/\s+/g, '');
        const cardExpiry = cardExpiryInput?.value.trim();
        const cardCvv = cardCvvInput?.value.trim();

        // 1. فحص رقم الكارت (16 رقم)
        const cardNumberRegex = /^\d{16}$/;
        if (!cardNumberRegex.test(cardNumber)) {
            showError(cardNumberInput, "Please enter a valid 16-digit Card Number.");
            return;
        }

        // 2. فحص تاريخ الانتهاء (MM/YY) والتأكد إنه مش منتهي
        const expiryRegex = /^(0[1-9]|1[0-2])\/?([0-9]{2})$/;
        if (!expiryRegex.test(cardExpiry)) {
            showError(cardExpiryInput, "Please enter a valid Expiry Date in MM/YY format.");
            return;
        } else {
            const [month, year] = cardExpiry.includes('/') ? cardExpiry.split('/') : [cardExpiry.slice(0, 2), cardExpiry.slice(2)];
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = parseInt(currentDate.getFullYear().toString().slice(-2));

            if (parseInt(year) < currentYear || (parseInt(year) === currentYear && parseInt(month) < currentMonth)) {
                showError(cardExpiryInput, "This card has expired. Please use a valid card.");
                return;
            }
        }

        // 3. فحص الـ CVV (3 أو 4 أرقام)
        const cvvRegex = /^\d{3,4}$/;
        if (!cvvRegex.test(cardCvv)) {
            showError(cardCvvInput, "Please enter a valid 3 or 4 digit CVC.");
            return;
        }
    }
    // ==========================================
    
    // سحب وتلميع الملاحظات
    const notesField = document.getElementById('order-notes');
    const orderNotes = notesField ? escapeHTML(notesField.value.trim()) : '';

    buttonBtn.classList.add('loading');
    const originalText = buttonBtn.innerHTML;
    buttonBtn.innerHTML = '<div class="spinner" style="display:block;"></div> Processing...';
    buttonBtn.disabled = true;

    // الداتا اللي هتتبعت للباك إند
    const orderPayload = {
        customer_id: customerId, 
        cart_items: cart.map(item => ({
            id: item.id,
            quantity: item.quantity,
            price: item.price
        })),
        payment_method: paymentMethod,
        order_type: mode, 
        table_id: selectedTable !== 'Any' ? selectedTable : null,
        delivery_address: deliveryAddress, 
        subtotal: subtotal,
        tax: tax,
        total: parseFloat(totalWithTax),
        notes: orderNotes,
        res_date: resDate,
        res_time: resTime,
        party_size: partySize 
    };

    try {
        // 🔴 إعداد الـ Headers بناءً على وجود توكن أو لأ
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/checkout`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(orderPayload)
        });

        const result = await response.json();

        if (response.ok) {
            localStorage.removeItem('cartItems');
            localStorage.setItem('lastOrderID', result.order_id);
            localStorage.setItem('receiptNumber', result.receipt_number);
            
            alert('Payment Successful! Order ID: ' + result.order_id); // دي هنسيبها عشان بتوجه لصفحة تانية
            window.location.href = '../tracking/tracking.html'; 
        } else {
            showError(buttonBtn, 'Payment failed: ' + result.error);
            buttonBtn.innerHTML = originalText;
            buttonBtn.disabled = false;
        }

    } catch (error) {
        console.error("Error processing checkout:", error);
        showError(buttonBtn, 'Server connection error. Please make sure the Flask server is running.');
        buttonBtn.innerHTML = originalText;
        buttonBtn.disabled = false;
    }
}