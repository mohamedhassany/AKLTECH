// ================= SIDEBAR NAVIGATION & TOGGLE =================
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        const page = this.getAttribute('data-target');
        if (page && page !== "#") {
            window.location.href = page;
        }
    });
});

const sidebar = document.getElementById('sidebar');
const sidebarArrow = document.getElementById('sidebar-arrow');
const mobileToggle = document.getElementById('mobile-toggle');
const closeSidebar = document.getElementById('close-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// تصغير/تكبير السايد بار (الديسك توب)
if(sidebarArrow){
    sidebarArrow.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

// فتح السايد بار (الموبايل)
if(mobileToggle){
    mobileToggle.addEventListener('click', () => {
        sidebar.classList.add('mobile-active');
        sidebarOverlay.classList.add('active');
    });
}

// قفل السايد بار (الموبايل) - عن طريق زر X أو الضغط على الطبقة السوداء
[closeSidebar, sidebarOverlay].forEach(element => {
    if(element){
        element.addEventListener('click', () => {
            sidebar.classList.remove('mobile-active');
            sidebarOverlay.classList.remove('active');
        });
    }
});

// ================= LIGHT / DARK MODE TOGGLE =================
const themeToggle = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme') || 'dark'; // خليتها ديفولت دارك عشان تليق مع التصميم

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

// ================= LOGOUT =================
const btnLogout = document.getElementById('btn-logout');
if(btnLogout){
    btnLogout.addEventListener('click', () => {
        if(confirm("Are you sure you want to logout?")) {
            localStorage.removeItem("manager"); 
            window.location.href = "../login/login.html";
        }
    });
}

// ================= MENU MANAGEMENT =================
const API_URL = "http://127.0.0.1:5000/manager/menu";

document.addEventListener("DOMContentLoaded", fetchMenu);

async function fetchMenu() {
    try {
        const response = await fetch(API_URL);
        const items = await response.json();
        const grid = document.getElementById("menu-grid");
        grid.innerHTML = "";

        items.forEach(item => {
            const card = document.createElement("div");
            card.className = "menu-card";
            
            const statusClass = item.is_available ? "status-available" : "status-unavailable";
            const statusText = item.is_available ? "Available" : "Unavailable";
            const safeItemJson = JSON.stringify(item).replace(/'/g, "&#39;");

            let badges = '';
            if(item.is_spicy) badges += '<span title="Spicy">🌶️</span> ';
            if(item.is_vegan) badges += '<span title="Vegan">🥬</span> ';
            if(item.is_healthy) badges += '<span title="Healthy">🥗</span> ';

            card.innerHTML = `
                <img src="${item.image_url || 'https://via.placeholder.com/300x200?text=No+Image'}" alt="${item.name}" class="menu-card-img">
                <div class="menu-card-body">
                    <h3 class="menu-card-title">${item.name} ${badges}</h3>
                    <p class="menu-card-desc">${item.description || 'No description provided.'}</p>
                    
                    <div class="menu-card-footer">
                        <span class="menu-card-price">$${item.price}</span>
                        <span class="menu-card-status ${statusClass}">${statusText}</span>
                    </div>
                    
                    <div class="menu-card-actions">
                        <button class="btn btn-outline" onclick='editMenu(${safeItemJson})'><i class="fa-solid fa-pen"></i> Edit</button>
                        <button class="btn btn-danger" onclick="deleteMenu(${item.MENU_ITEM_ID})"><i class="fa-solid fa-trash"></i> Delete</button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error("Error fetching menu:", error);
    }
}

function openMenuModal() {
    // تفريغ الفورم
    document.getElementById("item-id").value = "";
    document.querySelectorAll('.modal-body .input-field').forEach(input => input.value = "");
    
    document.getElementById("item-available").checked = true;
    document.getElementById("item-spicy").checked = false;
    document.getElementById("item-vegan").checked = false;
    document.getElementById("item-healthy").checked = false;
    
    document.getElementById("modal-title").innerHTML = '<i class="fa-solid fa-burger"></i> Add Menu Item';
    document.getElementById("menuModal").style.display = "flex";
}

function closeMenuModal() {
    document.getElementById("menuModal").style.display = "none";
}

function editMenu(item) {
    document.getElementById("item-id").value = item.MENU_ITEM_ID;
    document.getElementById("item-name").value = item.name || "";
    document.getElementById("item-desc").value = item.description || "";
    document.getElementById("item-price").value = item.price || "";
    document.getElementById("item-image").value = item.image_url || "";
    document.getElementById("item-category").value = item.MENU_CATEGORY_ID || "";
    document.getElementById("item-type").value = item.item_type || "";
    document.getElementById("item-cuisine").value = item.Cuisine || "";
    document.getElementById("item-calories").value = item.calories || "";

    document.getElementById("item-time-from").value = item.available_from_time ? item.available_from_time.substring(0, 5) : "";
    document.getElementById("item-time-to").value = item.available_to_time ? item.available_to_time.substring(0, 5) : "";
    document.getElementById("item-date-start").value = item.season_start_date || "";
    document.getElementById("item-date-end").value = item.season_end_date || "";

    document.getElementById("item-available").checked = !!item.is_available;
    document.getElementById("item-spicy").checked = !!item.is_spicy;
    document.getElementById("item-vegan").checked = !!item.is_vegan;
    document.getElementById("item-healthy").checked = !!item.is_healthy;

    document.getElementById("modal-title").innerHTML = '<i class="fa-solid fa-pen"></i> Edit Menu Item';
    document.getElementById("menuModal").style.display = "flex";
}

async function saveMenuItem() {
    const id = document.getElementById("item-id").value;
    
    const itemData = {
        name: document.getElementById("item-name").value,
        MENU_CATEGORY_ID: parseInt(document.getElementById("item-category").value),
        price: parseFloat(document.getElementById("item-price").value),
        description: document.getElementById("item-desc").value,
        image_url: document.getElementById("item-image").value,
        item_type: document.getElementById("item-type").value,
        Cuisine: document.getElementById("item-cuisine").value,
        calories: parseInt(document.getElementById("item-calories").value) || null,
        
        available_from_time: document.getElementById("item-time-from").value || null,
        available_to_time: document.getElementById("item-time-to").value || null,
        season_start_date: document.getElementById("item-date-start").value || null,
        season_end_date: document.getElementById("item-date-end").value || null,

        is_available: document.getElementById("item-available").checked,
        is_spicy: document.getElementById("item-spicy").checked,
        is_vegan: document.getElementById("item-vegan").checked,
        is_healthy: document.getElementById("item-healthy").checked
    };

    if(!itemData.name || !itemData.price) {
        alert("Please enter Name and Price.");
        return;
    }

    const method = id ? "PUT" : "POST";
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        const response = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(itemData)
        });
        
        if(response.ok) {
            closeMenuModal();
            fetchMenu();
        } else {
            alert("Error saving item.");
        }
    } catch (error) {
        console.error("Error saving menu item:", error);
    }
}

async function deleteMenu(id) {
    if(!confirm("Are you sure you want to delete this item?")) return;
    
    try {
        const response = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
        if(response.ok) {
            fetchMenu();
        } else {
            alert("Error deleting item.");
        }
    } catch (error) {
        console.error("Error deleting menu item:", error);
    }
}

// قفل المودال لو المستخدم ضغط بره الصندوق
window.onclick = function(event) {
    const modal = document.getElementById("menuModal");
    if (event.target == modal) {
        closeMenuModal();
    }
}