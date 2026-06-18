let currentProfileData = {}; // متغير عشان نحفظ فيه الداتا الحالية
let allOrders = []; // المتغير الجديد لحفظ كل الطلبات بدون التأثير على الأداء
const API_BASE_URL = 'http://127.0.0.1:5000/api'; // لسهولة تعديل الرابط مستقبلاً

document.addEventListener("DOMContentLoaded", async () => {
    // 🔴 التعديل الأمني: التحقق من وجود التوكن بدل الـ ID
    const token = localStorage.getItem("jwtToken");
    if (!token) {
        window.location.href = "../login/login.html";
        return;
    }

    // استدعاء الدالة اللي بتجيب الداتا من غير ما نبعت الـ ID (السيرفر هيعرفه من التوكن)
    fetchProfileData();
});

// ==========================================
// 1. دالة جلب البيانات من السيرفر
// ==========================================
async function fetchProfileData() {
    const token = localStorage.getItem("jwtToken");
    try {
        // 🔴 التعديل الأمني: حذفنا الـ customerId من الرابط وضفنا الهيدر
        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`, // إرسال التوكن
                'Content-Type': 'application/json'
            }
        });
        
        // لو التوكن منتهية أو غلط، نخرج اليوزر
        if (response.status === 401) {
            alert("Your session has expired. Please login again.");
            logoutUser();
            return;
        }

        const data = await response.json();

        if (response.ok) {
            currentProfileData = data.user; // حفظ البيانات عالمياً في المتغير

            // تحديث بيانات الواجهة (Display Mode)
            document.getElementById("user-name").innerText = data.user.NAME;
            document.getElementById("user-email").innerText = data.user.EMAIL;
            document.getElementById("user-phone").innerText = data.user.PHONE || "No phone added";

            // عرض الصورة لو موجودة
            if (data.user.IMAGE) {
                document.getElementById("default-avatar-icon").style.display = "none";
                const imgDisplay = document.getElementById("profile-image-display");
                imgDisplay.src = data.user.IMAGE;
                imgDisplay.style.display = "block";
            }

            // حفظ الطلبات في المتغير الخارجي
            allOrders = data.orders || [];

            // تعيين الشهر الحالي كافتراضي وتطبيق الفلتر تلقائياً وقت التحميل
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            const monthInput = document.getElementById("order-month-filter");
            if (monthInput && !monthInput.value) {
                monthInput.value = currentMonth;
            }
            
            // تطبيق الفلتر بناءً على القيمة (لو مفيش input هنبعت الشهر الحالي)
            applyFilter(monthInput ? monthInput.value : currentMonth);
        }
    } catch (error) {
        console.error("Error fetching profile:", error);
    }
}

// ==========================================
// 2. دوال التحكم في الواجهة (Edit Mode)
// ==========================================
function enableEdit() {
    document.getElementById("display-mode").style.display = "none";
    document.getElementById("edit-mode").style.display = "block";
    
    document.getElementById("edit-name").value = currentProfileData.NAME || "";
    document.getElementById("edit-phone").value = currentProfileData.PHONE || "";
    document.getElementById("edit-email-display").innerText = currentProfileData.EMAIL || "";
}

function cancelEdit() {
    document.getElementById("edit-mode").style.display = "none";
    document.getElementById("display-mode").style.display = "block";
}

// ==========================================
// 3. دالة الحفظ (Save Profile)
// ==========================================
async function saveProfile(event) {
    if (event) event.preventDefault(); 
    
    const token = localStorage.getItem("jwtToken");
    const newName = document.getElementById("edit-name").value.trim();
    const newPhone = document.getElementById("edit-phone").value.trim();
    const imageInput = document.getElementById("edit-image");

    if (!newPhone) {
        alert("Phone number is required.");
        return;
    }

    const phoneRegex = /^01[0125][0-9]{8}$/;
    if (!phoneRegex.test(newPhone)) {
        alert("Please enter a valid Egyptian phone number (e.g., 01012345678).");
        return;
    }

    const saveBtn = document.getElementById("save-profile-btn") || (event ? event.target : null);
    let originalBtnText = "Save";
    if (saveBtn) {
        originalBtnText = saveBtn.innerText;
        saveBtn.innerText = "Saving...";
        saveBtn.disabled = true;
    }

    let profileImageBase64 = currentProfileData.IMAGE || null;

    if (imageInput && imageInput.files && imageInput.files[0]) {
        const file = imageInput.files[0];
        try {
            profileImageBase64 = await toBase64(file);
        } catch (error) {
            alert("Error reading image file.");
            if (saveBtn) {
                saveBtn.innerText = originalBtnText;
                saveBtn.disabled = false;
            }
            return;
        }
    }

    try {
        // 🔴 التعديل الأمني: تحديث الرابط وضبط الهيدر
        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                name: newName,
                phone: newPhone,
                profile_image: profileImageBase64
            })
        });

        if (response.status === 401) {
            alert("Your session has expired. Please login again.");
            logoutUser();
            return;
        }

        if (response.ok) {
            cancelEdit();
            fetchProfileData(); 
            if (imageInput) imageInput.value = "";
            alert("Profile updated successfully!");
        } else {
            const errorData = await response.json();
            alert("Error: " + (errorData.error || "Failed to update profile"));
        }
    } catch (error) {
        console.error("Error updating profile:", error);
        alert("Network error occurred.");
    } finally {
        if (saveBtn) {
            saveBtn.innerText = originalBtnText;
            saveBtn.disabled = false;
        }
    }
}

// ==========================================
// 4. دالة مساعدة لتحويل الصورة لـ Base64 
// ==========================================
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// ==========================================
// 5. دالة تسجيل الخروج
// ==========================================
function logoutUser(event) {
    if (event) event.preventDefault();
    localStorage.removeItem("jwtToken"); // 🔴 مسح التوكن
    localStorage.removeItem("customerId");
    localStorage.removeItem("customer_id");
    localStorage.removeItem("diningMode");
    window.location.href = "../home/home.html";
}

window.toggleMenu = function() {
    const nav = document.querySelector('.navig');
    if (nav) {
        nav.classList.toggle('active');
    }
};

// ==========================================
// 6. دوال مسح الحساب (Delete Account)
// ==========================================
function showDeleteModal() {
    document.getElementById("delete-password").value = ""; 
    document.getElementById("delete-modal").style.display = "flex";
}

function hideDeleteModal() {
    document.getElementById("delete-modal").style.display = "none";
}

async function confirmDeleteAccount() {
    const password = document.getElementById("delete-password").value;
    const token = localStorage.getItem("jwtToken"); // 🔴 جلب التوكن
    
    if (!password) {
        alert("Please enter your password to confirm.");
        return;
    }

    const btn = document.getElementById("confirm-delete-btn");
    const originalText = btn.innerText;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    btn.disabled = true;

    try {
        // 🔴 التعديل الأمني: إضافة Authorization
        const response = await fetch(`${API_BASE_URL}/profile`, {
            method: 'DELETE',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password: password })
        });

        if (response.status === 401) {
            const result = await response.json();
            alert(result.error || "Session expired or invalid password.");
            if(result.error && result.error.includes("expired")) {
                 logoutUser();
            } else {
                 btn.innerHTML = originalText;
                 btn.disabled = false;
            }
            return;
        }

        const result = await response.json();

        if (response.ok) {
            alert("Your account has been successfully deleted.");
            logoutUser(); // دالة الخروج هتمسح كل حاجة وتوجه للصفحة الرئيسية
        } else {
            alert(result.error || "Failed to delete account.");
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    } catch (error) {
        console.error("Error deleting account:", error);
        alert("A network error occurred. Please try again.");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ==========================================
// 7. دوال فلترة وعرض الطلبات
// ==========================================

// دالة منفصلة مسئولة عن رسم الجدول بس
function renderOrders(ordersArray) {
    const ordersTable = document.getElementById("orders-list");
    let ordersHTML = ""; 
    
    if (!ordersArray || ordersArray.length === 0) {
        ordersHTML = "<tr><td colspan='3' style='text-align:center; padding: 30px;'>No orders found for this period.</td></tr>";
    } else {
        ordersArray.forEach(order => {
            let date = order.ORD_DATE ? new Date(order.ORD_DATE).toLocaleDateString() : 'N/A';
            let total = order.TOTAL_PRICE !== null ? parseFloat(order.TOTAL_PRICE).toFixed(2) : '0.00';
            ordersHTML += `
                <tr>
                    <td>#${order.ORD_ID}</td>
                    <td>${date}</td>
                    <td>$${total}</td>
                </tr>
            `;
        });
    }
    ordersTable.innerHTML = ordersHTML; 
}

// دالة تطبيق الفلتر بناءً على القيمة المختارة
function applyFilter(selectedValue) {
    const clearBtn = document.getElementById("clear-filter-btn");
    
    if (selectedValue) {
        if (clearBtn) clearBtn.style.display = "inline-block";
        const [year, month] = selectedValue.split("-");
        
        // فلترة الـ Array بناءً على الشهر والسنة
        const filteredOrders = allOrders.filter(order => {
            if (!order.ORD_DATE) return false;
            const orderDate = new Date(order.ORD_DATE);
            return orderDate.getFullYear() === parseInt(year) && 
                   (orderDate.getMonth() + 1) === parseInt(month);
        });
        
        renderOrders(filteredOrders);
    } else {
        if (clearBtn) clearBtn.style.display = "none";
        // تريك الأداء: لو المستخدم مسح الفلتر، هنعرض أحدث 50 أوردر بس عشان المتصفح ميعلقش
        renderOrders(allOrders.slice(0, 50)); 
    }
}

// مسح الفلتر بالكامل
window.clearFilter = function() {
    const monthFilter = document.getElementById("order-month-filter");
    if (monthFilter) {
        monthFilter.value = "";
        applyFilter("");
    }
};

// تشغيل الفلتر لما المستخدم يغير التاريخ
document.addEventListener("DOMContentLoaded", () => {
    const monthFilter = document.getElementById("order-month-filter");
    if (monthFilter) {
        monthFilter.addEventListener("change", (e) => {
            applyFilter(e.target.value);
        });
    }
});