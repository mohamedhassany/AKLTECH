// ==========================================
// 1. إعدادات الصفحة عند التحميل (Navbar & Checkout Button)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // ----- الجزء الأول: تحديث الـ Navbar -----
    const userNavLinks = document.getElementById("user-nav-links");
    const customerId = localStorage.getItem("customerId");

    if (userNavLinks) {
        if (customerId) {
            userNavLinks.innerHTML = `
                <li style="list-style: none;"><a href="../profile/profile.html">My Profile</a></li>
                <li style="list-style: none;"><a href="#" onclick="logoutUser(event)" style="color: #ff4757; font-weight: bold;">Logout</a></li>
            `;
        } else {
            userNavLinks.innerHTML = `
                <li style="list-style: none;"><a href="../login/login.html">Login</a></li>
            `;
        }
    }

    // ----- الجزء التاني: تحديث نص زرار الدفع -----
    const checkoutBtn = document.querySelector('.checkout-btn');
    const mode = localStorage.getItem("diningMode");

    if (checkoutBtn) {
        if (mode === "reservation" || mode === "dine_in") {
            checkoutBtn.innerText = "Proceed to Table Selection";
        } else {
            checkoutBtn.innerText = "Proceed to Checkout"; 
        }
    }
});

window.logoutUser = function(event) {
    if (event) event.preventDefault(); 
    localStorage.removeItem("customerId");
    localStorage.removeItem("customer_id");
    localStorage.removeItem("diningMode");
    window.location.href = "../home/home.html";
};

// ==========================================
// ===== DYNAMIC DATA (Menu Items) =====
// ==========================================
let menuItems = []; 

async function fetchMenuItems() {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/menu');
        if (!response.ok) throw new Error('Network response was not ok');
        
        menuItems = await response.json();
        renderMenu(); 
    } catch (error) {
        console.error("Error fetching menu:", error);
        document.getElementById('menu-grid').innerHTML = '<p style="text-align:center; width:100%; grid-column: 1 / -1;">عذراً، لم نتمكن من تحميل قائمة الطعام. تأكد من تشغيل السيرفر.</p>';
    }
}

const menuGrid = document.getElementById('menu-grid');

function renderMenu(filter = 'all') {
    menuGrid.innerHTML = ''; 
    
    const filteredItems = filter === 'all' 
        ? menuItems 
        : menuItems.filter(item => item.category === filter);

    filteredItems.forEach(item => {
        const card = document.createElement('div');
        card.classList.add('menu-card');
        card.innerHTML = `
            <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
            <div class="card-info">
                <h3>${item.name}</h3>
                <p>${item.description || 'No description available.'}</p>
                <div class="price-row">
                    <span class="price">E£${Number(item.price).toFixed(2)}</span>
                    <button class="add-btn" onclick="addToCart(${item.id})">
                        + Add
                    </button>
                </div>
            </div>
        `;
        menuGrid.appendChild(card);
    });
}

const tabs = document.querySelectorAll('.tab-btn');
tabs.forEach(tab => {
    tab.addEventListener('click', function() {
        tabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
    });
});

fetchMenuItems();

function filterMenu(category) {
    renderMenu(category);
}

// ===== CART LOGIC =====
let cart = [];

function addToCart(id) {
    const item = menuItems.find(i => i.id === id);
    const existingItem = cart.find(i => i.id === id);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ ...item, quantity: 1 });
    }
    updateCartUI();
}

function updateCartUI() {
    const cartItemsContainer = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    const countEl = document.getElementById('cart-count');
    
    cartItemsContainer.innerHTML = '';
    let total = 0;
    let count = 0;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-msg">Your cart is empty.</p>';
    } else {
        cart.forEach(item => {
            total += item.price * item.quantity;
            count += item.quantity;
            
            const itemEl = document.createElement('div');
            itemEl.classList.add('cart-item');
            itemEl.innerHTML = `
                <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/60'">
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <p>E£${Number(item.price).toFixed(2)}</p>
                    <div class="cart-controls">
                        <button class="qty-btn" onclick="changeQty(${item.id}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
                        <i class="fa-solid fa-trash remove-btn" onclick="removeItem(${item.id})"></i>
                    </div>
                </div>
            `;
            cartItemsContainer.appendChild(itemEl);
        });
    }

    totalEl.innerText = `E£${total.toFixed(2)}`;
    countEl.innerText = count;
}

function changeQty(id, change) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeItem(id);
        } else {
            updateCartUI();
        }
    }
}

function removeItem(id) {
    cart = cart.filter(i => i.id !== id);
    updateCartUI();
}

function toggleCart(forceOpen = false) {
    const sidebar = document.getElementById('cart-sidebar');
    if (forceOpen) {
        sidebar.classList.add('open');
    } else {
        sidebar.classList.toggle('open');
    }
}

function selectDiningMode(mode) {
    localStorage.setItem("serviceType", mode);
}

function proceedToTable() {
    if (cart.length === 0) {
        alert("Your cart is empty! Add some delicious food first.");
        return;
    }

    localStorage.setItem('cartItems', JSON.stringify(cart));
    
    const mode = localStorage.getItem("diningMode"); 
    const isLoggedIn = localStorage.getItem("customerId"); 

    if (!isLoggedIn && (mode === "reservation" || mode === "delivery")) {
        alert("Please login first to proceed with Reservation or Delivery.");
        window.location.href = "../login/login.html";
        return; 
    }

    if (mode === "reservation" || mode === "dine_in") {
        window.location.href = "../tablereservation/tablereservation.html";
    } else {
        window.location.href = "../checkout/checkout.html";
    }
}

// ==========================================
// ===== AI RECOMMENDATION LOGIC (FLAWLESS & TRANSPARENT DEDUCTION) =====
// ==========================================
const modal = document.getElementById('ai-modal');
const questionText = document.getElementById('ai-question-text');
const optionsContainer = document.getElementById('ai-options');

let aiStep = 0;
let userPreferences = {
    category: 'any',   
    hunger: 'any',     
    diet: 'none',      
    spice: 'mild',     
    cuisine: 'any',    
    budget: 'any'      
};

function startAIFlow() {
    modal.style.display = "block";
    aiStep = 1;
    userPreferences = { category: 'any', hunger: 'any', diet: 'none', spice: 'mild', cuisine: 'any', budget: 'any' };
    askQuestion();
}

function closeAIModal() {
    modal.style.display = "none";
}

function askQuestion() {
    optionsContainer.innerHTML = ''; 

    if (aiStep === 1) {
        questionText.innerHTML = "Chef: <em>\"Welcome! What are you craving right now?\"</em>";
        createOptionBtn('<i class="fa-solid fa-bell-concierge"></i> A full Main Dish', 'Main Dishes', 1);
        createOptionBtn('<i class="fa-solid fa-cookie-bite"></i> An Appetizer / Snack', 'Appetizers', 1);
        createOptionBtn('<i class="fa-solid fa-ice-cream"></i> Something Sweet (Dessert)', 'Desserts', 1);
        createOptionBtn('<i class="fa-solid fa-mug-hot"></i> Just a Drink', 'Drinks', 1);
        createOptionBtn('<i class="fa-solid fa-wand-magic-sparkles"></i> Surprise Me!', 'any', 1);
    } 
    else if (aiStep === 2) {
        if (userPreferences.category === 'Drinks') {
            questionText.innerHTML = "Chef: <em>\"Got it! Looking for something refreshing or rich?\"</em>";
            createOptionBtn('<i class="fa-solid fa-droplet"></i> Light & Refreshing (Juice/Smoothie)', 'light', 2);
            createOptionBtn('<i class="fa-solid fa-mug-hot"></i> Rich & Warm (Coffee/Chocolate)', 'heavy', 2);
            createOptionBtn('<i class="fa-solid fa-face-smile"></i> Doesn\'t matter', 'any', 2);
        } else if (userPreferences.category === 'Desserts') {
            questionText.innerHTML = "Chef: <em>\"Sweet! Do you want a light treat or something decadent?\"</em>";
            createOptionBtn('<i class="fa-solid fa-feather"></i> Light Treat', 'light', 2);
            createOptionBtn('<i class="fa-solid fa-cake-candles"></i> Rich & Decadent', 'heavy', 2);
            createOptionBtn('<i class="fa-solid fa-face-smile"></i> Anything sweet is good!', 'any', 2);
        } else {
            questionText.innerHTML = "Chef: <em>\"Got it! How hungry are you?\"</em>";
            createOptionBtn('<i class="fa-solid fa-feather"></i> Light & Easy (Under 400 Cal)', 'light', 2);
            createOptionBtn('<i class="fa-solid fa-burger"></i> Starving! (Hearty meal)', 'heavy', 2);
            createOptionBtn('<i class="fa-solid fa-face-smile"></i> It doesn\'t matter', 'any', 2);
        }
    } 
    else if (aiStep === 3) {
        questionText.innerHTML = "Chef: <em>\"Do you have any specific dietary focus?\"</em>";
        createOptionBtn('<i class="fa-solid fa-leaf"></i> Strictly Vegan', 'vegan', 3);
        createOptionBtn('<i class="fa-solid fa-apple-whole"></i> Keep it Healthy', 'healthy', 3);
        createOptionBtn('<i class="fa-solid fa-utensils"></i> No Restrictions', 'none', 3);
    } 
    else if (aiStep === 4) {
        if (userPreferences.category === 'Drinks' || userPreferences.category === 'Desserts') {
            userPreferences.spice = 'mild'; 
            aiStep++;
            return askQuestion(); 
        }
        questionText.innerHTML = "Chef: <em>\"How do you feel about spicy food?\"</em>";
        createOptionBtn('<i class="fa-solid fa-pepper-hot"></i> Bring the Heat! (Spicy)', 'spicy', 4);
        createOptionBtn('<i class="fa-solid fa-thumbs-up"></i> Keep it Mild, please', 'mild', 4);
    } 
    else if (aiStep === 5) {
        if (userPreferences.category === 'Drinks') {
            userPreferences.cuisine = 'any'; 
            aiStep++;
            return askQuestion(); 
        }
        questionText.innerHTML = "Chef: <em>\"Which culinary world should we explore?\"</em>";
        createOptionBtn('<i class="fa-solid fa-pizza-slice"></i> Italian', 'Italian', 5);
        createOptionBtn('<i class="fa-solid fa-plate-wheat"></i> Middle Eastern', 'Middle Eastern', 5);
        createOptionBtn('<i class="fa-solid fa-hotdog"></i> American / International', 'American', 5);
        createOptionBtn('<i class="fa-solid fa-globe"></i> Any cuisine is fine', 'any', 5);
    } 
    else if (aiStep === 6) {
        questionText.innerHTML = "Chef: <em>\"Finally, what's your budget for this item?\"</em>";
        createOptionBtn('<i class="fa-solid fa-coins"></i> Budget-Friendly (Under 100 E£)', 'low', 6);
        createOptionBtn('<i class="fa-solid fa-gem"></i> Premium Experience (Over 100 E£)', 'high', 6);
        createOptionBtn('<i class="fa-solid fa-wallet"></i> Price doesn\'t matter', 'any', 6);
    }
    else {
        showThinkingAnimation();
    }
}

function createOptionBtn(text, value, step) {
    const btn = document.createElement('button');
    btn.classList.add('ai-option-btn');
    btn.innerHTML = text; 
    btn.onclick = () => {
        if (step === 1) userPreferences.category = value;
        if (step === 2) userPreferences.hunger = value;
        if (step === 3) userPreferences.diet = value;
        if (step === 4) userPreferences.spice = value;
        if (step === 5) userPreferences.cuisine = value;
        if (step === 6) userPreferences.budget = value;
        aiStep++;
        askQuestion();
    };
    optionsContainer.appendChild(btn);
}

function showThinkingAnimation() {
    questionText.innerHTML = "Chef is running his algorithm to find the perfect match...";
    optionsContainer.innerHTML = '<div class="chef-loading"><i class="fa-solid fa-fire-burner fa-bounce"></i></div>';
    setTimeout(showRecommendation, 1500); 
}

function showRecommendation() {
    if (menuItems.length === 0) {
        questionText.innerText = "Menu is empty. Please check back later!";
        optionsContainer.innerHTML = '';
        return;
    }

    // --- 1. الـ Hard Filter (تحديد القسم) ---
    let validItems = menuItems;
    if (userPreferences.category !== 'any') {
        validItems = menuItems.filter(item => {
            if (userPreferences.category === 'Drinks') return item.category === 'Hot Drinks' || item.category === 'Cold Drinks';
            return item.category === userPreferences.category;
        });
    }

    if (validItems.length === 0) validItems = menuItems; 

    // --- 2. إعطاء نقط للوجبات ---
    let scoredItems = validItems.map(item => {
        let score = 0;
        if (userPreferences.hunger === 'light' && item.calories <= 400) score += 15;
        if (userPreferences.hunger === 'heavy' && item.calories > 400) score += 15;
        if (userPreferences.diet === 'vegan' && item.is_vegan == 1) score += 20;
        if (userPreferences.diet === 'healthy' && item.is_healthy == 1) score += 20;
        if (userPreferences.spice === 'spicy' && item.is_spicy == 1) score += 10;
        if (userPreferences.spice === 'mild' && item.is_spicy == 0) score += 10;
        if (userPreferences.cuisine !== 'any' && (item.cuisine === userPreferences.cuisine || (userPreferences.cuisine === 'American' && item.cuisine === 'International'))) score += 15;
        if (userPreferences.budget === 'low' && item.price <= 100) score += 10;
        if (userPreferences.budget === 'high' && item.price > 100) score += 10;
        return { ...item, matchScore: score };
    });

    scoredItems.sort((a, b) => b.matchScore - a.matchScore);
    let topScore = scoredItems[0].matchScore;
    let bestMatches = scoredItems.filter(item => item.matchScore === topScore);
    let recommendation = bestMatches[Math.floor(Math.random() * bestMatches.length)];

    // --- 3. نظام كشف التنازلات (Feedback System) ---
    // بنشوف الوجبة اللي اخترناها هل فعلاً طابقت طلبات العميل ولا وقع منها حاجات؟
    let missedCriteria = [];

    // فحص الميزانية
    if (userPreferences.budget === 'low' && recommendation.price > 100) missedCriteria.push("your budget limit");
    
    // فحص الدايت
    if (userPreferences.diet === 'vegan' && recommendation.is_vegan != 1) missedCriteria.push("a vegan diet");
    if (userPreferences.diet === 'healthy' && recommendation.is_healthy != 1) missedCriteria.push("a strict healthy diet");

    // فحص السعرات
    if (userPreferences.hunger === 'light' && recommendation.calories > 400) missedCriteria.push("low calories");
    if (userPreferences.hunger === 'heavy' && recommendation.calories <= 400) missedCriteria.push("a large hearty portion");

    // فحص المطبخ والتوابل (لو مش مشروبات وحلويات)
    if (userPreferences.category !== 'Drinks' && userPreferences.category !== 'Desserts') {
        if (userPreferences.spice === 'spicy' && recommendation.is_spicy != 1) missedCriteria.push("spicy flavor");
        if (userPreferences.cuisine !== 'any') {
            let recCuisine = recommendation.cuisine || 'International';
            if (userPreferences.cuisine !== recCuisine && !(userPreferences.cuisine === 'American' && recCuisine === 'International')) {
                missedCriteria.push(`${userPreferences.cuisine} cuisine`);
            }
        }
    }

    // صياغة الرسالة النهائية بناءً على التنازلات
    let categoryNameText = "dish";
    if (userPreferences.category === 'Desserts') categoryNameText = "dessert";
    else if (userPreferences.category === 'Drinks') categoryNameText = "drink";
    else if (userPreferences.category === 'Main Dishes') categoryNameText = "main dish";
    else if (userPreferences.category === 'Appetizers') categoryNameText = "appetizer";

    if (missedCriteria.length === 0) {
        // تطابق تام 100%
        questionText.innerHTML = "Chef: <em>\"A 100% perfect match! I strongly recommend this for you.\"</em>";
    } else {
        // لو في حاجة مش مطابقة (زي الميزانية)، نكتبها بشكل أنيق للمستخدم
        let missedText = missedCriteria.join(" and ");
        questionText.innerHTML = `Chef: <em>\"I couldn't find a ${categoryNameText} that matches exactly <strong>${missedText}</strong>, but this is the absolute best choice we have for you!\"</em>`;
    }

    optionsContainer.innerHTML = `
        <div class="recommendation-card">
            <img src="${recommendation.image}" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'" class="rec-img">
            <h4 class="rec-title">${recommendation.name}</h4>
            <p class="rec-desc">${recommendation.description || 'A delicious choice crafted for you.'}</p>
            <div style="display: flex; justify-content: center; gap: 15px; margin-bottom: 15px; font-size: 0.9rem; color: #666; flex-wrap: wrap;">
                <span title="Calories"><i class="fa-solid fa-fire" style="color: #ff4757;"></i> ${recommendation.calories} Cal</span>
                <span title="Cuisine"><i class="fa-solid fa-earth-americas" style="color: #2ed573;"></i> ${recommendation.cuisine || 'International'}</span>
                <span title="Category"><i class="fa-solid fa-tag" style="color: #3742fa;"></i> ${recommendation.category}</span>
            </div>
            <p class="rec-price">E£${Number(recommendation.price).toFixed(2)}</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button class="ai-btn" style="flex: 1;" onclick="addRecToCart(${recommendation.id})">
                    <i class="fa-solid fa-cart-plus"></i> Add to Cart
                </button>
                <button class="ai-btn" style="flex: 1; background: transparent; border: 2px solid var(--primary); color: var(--primary);" onclick="startAIFlow()">
                    <i class="fa-solid fa-rotate-right"></i> Start Over
                </button>
            </div>
        </div>
    `;
}

function addRecToCart(id) {
    addToCart(id);
    closeAIModal();
    toggleCart(true); 
}

window.onclick = function(event) {
    if (event.target == modal) {
        closeAIModal();
    }
}