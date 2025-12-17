// ===== MOCK DATA (Menu Items) =====
const menuItems = [
    {
        id: 1,
        name: "Bruschetta Platter",
        category: "Appetizers",
        price: 12.99,
        image: "https://foodal.com/wp-content/uploads/2022/07/Tomato-and-Fennel-Bruschetta-Pin.jpg",
        description: "Fresh tomatoes, basil, and mozzarella on toasted bread.",
        tags: ["light", "savory"]
    },
    {
        id: 2,
        name: "Crispy Calamari",
        category: "Appetizers",
        price: 14.99,
        image: "https://images.unsplash.com/photo-1604909052743-94e838986d24?auto=format&fit=crop&w=300&q=80",
        description: "Lightly fried squid with aioli sauce.",
        tags: ["filling", "savory"]
    },
    {
        id: 3,
        name: "Grilled Salmon",
        category: "Main Dishes",
        price: 24.50,
        image: "https://www.thecookierookie.com/wp-content/uploads/2023/05/grilled-salmon-recipe-2.jpg",
        description: "Atlantic salmon with steamed vegetables.",
        tags: ["light", "savory"]
    },
    {
        id: 4,
        name: "Buffalo Wings",
        category: "Main Dishes",
        price: 13.99,
        image: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=300&q=80",
        description: "Spicy chicken wings with blue cheese dip.",
        tags: ["filling", "spicy"]
    },
    {
        id: 5,
        name: "Chocolate Lava Cake",
        category: "Desserts",
        price: 8.99,
        image: "https://images.unsplash.com/photo-1624353365286-3f8d62daad51?auto=format&fit=crop&w=300&q=80",
        description: "Warm chocolate cake with a molten center.",
        tags: ["light", "sweet"]
    },
    {
        id: 6,
        name: "Classic Mojito",
        category: "Drinks",
        price: 7.50,
        image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=300&q=80",
        description: "Refreshing mint, lime, and soda.",
        tags: ["light", "sweet"]
    }
];

// ===== RENDER MENU =====
const menuGrid = document.getElementById('menu-grid');

function renderMenu(filter = 'all') {
    menuGrid.innerHTML = ''; // Clear current items
    
    const filteredItems = filter === 'all' 
        ? menuItems 
        : menuItems.filter(item => item.category === filter);

    filteredItems.forEach(item => {
        const card = document.createElement('div');
        card.classList.add('menu-card');
        card.innerHTML = `
            <img src="${item.image}" alt="${item.name}">
            <div class="card-info">
                <h3>${item.name}</h3>
                <p>${item.description}</p>
                <div class="price-row">
                    <span class="price">$${item.price.toFixed(2)}</span>
                    <button class="add-btn" onclick="addToCart(${item.id})">
                        + Add
                    </button>
                </div>
            </div>
        `;
        menuGrid.appendChild(card);
    });
}

// Handle Category Tabs Styling
const tabs = document.querySelectorAll('.tab-btn');
tabs.forEach(tab => {
    tab.addEventListener('click', function() {
        tabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
    });
});

// Render all items initially
renderMenu();

// ===== FILTER FUNCTION =====
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
    // تم إلغاء السطر التالي لمنع فتح السلة تلقائياً
    // toggleCart(true); 
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
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <p>$${item.price}</p>
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

    totalEl.innerText = `$${total.toFixed(2)}`;
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
    console.log("Selected service:", mode); // للتأكد
}

function proceedToTable() {
    if (cart.length === 0) {
        alert("Your cart is empty! Add some delicious food first.");
        return;
    }

    // حفظ محتويات السلة
    localStorage.setItem('cartItems', JSON.stringify(cart));

    // 1. قراءة المتغير الصحيح (diningMode) بدلاً من serviceType
    const mode = localStorage.getItem("diningMode"); 
    console.log("Dining Mode:", mode);

    // 2. التحقق من التوجيه
    // إذا كان حجز أو أكل داخل المطعم -> يذهب لاختيار الطاولة
    if (mode === "reservation" || mode === "dine_in") {
        window.location.href = "../tablereservation/tablereservation.html";
    } 
    // إذا كان دليفري أو تيك أواي -> يذهب للدفع فوراً
    else {
        window.location.href = "../checkout/checkout.html";
    }
}


// ===== AI RECOMMENDATION LOGIC =====
const modal = document.getElementById('ai-modal');
const questionText = document.getElementById('ai-question-text');
const optionsContainer = document.getElementById('ai-options');

let aiStep = 0;
let userPreferences = {};

function startAIFlow() {
    modal.style.display = "block";
    aiStep = 1;
    askQuestion();
}

function closeAIModal() {
    modal.style.display = "none";
}

function askQuestion() {
    optionsContainer.innerHTML = ''; // Clear previous buttons

    if (aiStep === 1) {
        questionText.innerText = "Do you prefer something light or filling?";
        createOptionBtn("Light", "light");
        createOptionBtn("Filling", "filling");
    } else if (aiStep === 2) {
        questionText.innerText = "What flavor profile are you craving?";
        createOptionBtn("Spicy / Savory", "savory"); // Simplified for logic
        createOptionBtn("Sweet", "sweet");
    } else {
        showRecommendation();
    }
}

function createOptionBtn(text, value) {
    const btn = document.createElement('button');
    btn.classList.add('ai-option-btn');
    btn.innerText = text;
    btn.onclick = () => {
        if (aiStep === 1) userPreferences.type = value;
        if (aiStep === 2) userPreferences.flavor = value;
        aiStep++;
        askQuestion();
    };
    optionsContainer.appendChild(btn);
}

function showRecommendation() {
    // Simple logic to find a match
    const recommendation = menuItems.find(item => 
        item.tags.includes(userPreferences.type) || 
        item.tags.includes(userPreferences.flavor)
    );

    if (recommendation) {
        questionText.innerText = `We recommend: ${recommendation.name}!`;
        optionsContainer.innerHTML = `
            <div style="grid-column: span 2; text-align: center;">
                <img src="${recommendation.image}" style="width: 100px; height: 100px; border-radius: 10px; margin-bottom: 10px;">
                <p>${recommendation.description}</p>
                <button class="ai-btn" style="margin-top: 10px;" onclick="addRecToCart(${recommendation.id})">Add to Cart</button>
            </div>
        `;
    } else {
        questionText.innerText = "We recommend our Chef's Special: Bruschetta!";
        // Fallback logic could go here
    }
}

function addRecToCart(id) {
    addToCart(id);
    closeAIModal();
}

// Close modal if clicking outside
window.onclick = function(event) {
    if (event.target == modal) {
        closeAIModal();
    }
}