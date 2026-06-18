const API_BASE_URL = 'https://mohassanyabd-akltech-api.hf.space/api';
// الاعتماد على التوكن
const token = localStorage.getItem('jwtToken');
// بنحتفظ بالـ ID مؤقتاً للتوافق مع باقي الملفات
const customerId = localStorage.getItem('customerId') || localStorage.getItem('customer_id');

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

document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // تحديث الـ Navbar بناءً على حالة تسجيل الدخول
    // ==========================================
    const navLinks = document.getElementById("nav-links");
    
    if (navLinks) {
        if (token) { // التحديث: بنشيك على التوكن
            navLinks.innerHTML = `
                <li><a href="../profile/profile.html">My Profile</a></li>
                <li><a href="../tracking/tracking.html">Tracking</a></li>
                <li><a href="../feedback/feedback.html">Feedback</a></li>
                <li><a href="../home/home.html#about-us">About us</a></li>
                <li><a href="#" onclick="logoutUser(event)">Logout</a></li>
            `;
        } else {
            navLinks.innerHTML = `
                <li><a href="../login/login.html">Register</a></li>
                <li><a href="../tracking/tracking.html">Tracking</a></li>
                <li><a href="../feedback/feedback.html">Feedback</a></li>
                <li><a href="../home/home.html#about-us">About us</a></li>
                <li><a href="../home/home.html#footerr">Contact us</a></li>
            `;
        }
    }
});

window.logoutUser = function(event) {
    if (event) event.preventDefault(); 
    localStorage.removeItem("jwtToken"); // مسح التوكن
    localStorage.removeItem("customerId");
    localStorage.removeItem("customer_id"); 
    localStorage.removeItem("diningMode");
    window.location.href = "../home/home.html";
};

let selectedTags = [];

// ==========================================
// 2. Fetch user orders (جلب الأوردرات)
// ==========================================
async function loadUserOrders() {
    const selectElement = document.getElementById('orderSelect');
    try {
        // 🔴 التعديل الأمني: استخدام مسار my-orders المؤمن وإرسال التوكن
        const response = await fetch(`${API_BASE_URL}/my-orders`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            alert("Session expired. Please login again.");
            logoutUser();
            return;
        }

        const orders = await response.json();
        
        selectElement.innerHTML = '<option value="" disabled selected>Select an order...</option>';
        
        if (orders.length === 0) {
            selectElement.innerHTML = '<option value="" disabled>No previous orders found</option>';
            return;
        }

        orders.forEach(order => {
            const date = new Date(order.timestamp).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
            const option = document.createElement('option');
            option.value = order.id;
            option.text = `Order #${order.id} - ${date} ($${order.totalPrice})`;
            selectElement.appendChild(option);
        });
    } catch (err) {
        console.error("Error loading orders:", err);
        selectElement.innerHTML = '<option value="" disabled>Error loading orders</option>';
    }
}

// ==========================================
// 3. Tag Selection Logic
// ==========================================
document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        this.classList.toggle('active');
        const tagValue = this.getAttribute('data-tag');
        
        if (this.classList.contains('active')) {
            selectedTags.push(tagValue);
        } else {
            selectedTags = selectedTags.filter(t => t !== tagValue);
        }
    });
});

// ==========================================
// 4. Form Submission Logic (إرسال التقييم)
// ==========================================
document.getElementById('feedbackForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const orderSelect = document.getElementById('orderSelect');
    const ratingInput = document.querySelector('input[name="rating"]:checked');
    const commentInput = document.getElementById('commentText');

    if (!orderSelect.value) {
        alert("Please select an order to rate.");
        return;
    }

    if (!ratingInput) {
        alert("Please select a rating (stars).");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = 'Submitting...';

    // 🔴 التعديل الأمني: تنظيف التعليق (الكومنت) قبل إرساله
    const safeComment = escapeHTML(commentInput.value.trim());
    
    const feedbackData = {
        // customer_id هيتعرف لوحده من السيرفر عن طريق التوكن
        order_id: parseInt(orderSelect.value),
        rating: parseInt(ratingInput.value),
        comment: safeComment,
        tags: escapeHTML(selectedTags.join(', ')) // تنظيف التاجز برضه للاحتياط
    };

    try {
        // 🔴 إرسال التوكن مع التقييم
        const response = await fetch(`${API_BASE_URL}/feedback`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(feedbackData)
        });

        if (response.status === 401) {
            alert("Session expired. Please login again.");
            logoutUser();
            return;
        }

        const result = await response.json();

        if (response.ok) {
            alert('Feedback submitted successfully! Thank you.');
            window.location.reload(); 
        } else {
            alert('Error: ' + (result.error || 'Please try again.'));
        }
    } catch (err) {
        console.error("Error submitting feedback:", err);
        alert('Connection error. Please make sure the server is running.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Submit Feedback';
    }
});

// ==========================================
// 5. Initialize
// ==========================================
window.onload = () => {
    if (token) { // بنشيك على التوكن
        loadUserOrders();
    } else {
        alert("Please login first to rate your orders.");
        window.location.href = "../login/login.html"; 
    }
};