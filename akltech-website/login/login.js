const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

// للموبايل 
const signUpMobileLink = document.getElementById('signUpMobile');
const signInMobileLink = document.getElementById('signInMobile');

// ==========================================
// 1. حركات الأنيميشن
// ==========================================
if (signUpButton) signUpButton.addEventListener('click', () => container.classList.add("right-panel-active"));
if (signInButton) signInButton.addEventListener('click', () => container.classList.remove("right-panel-active"));
if (signUpMobileLink) signUpMobileLink.addEventListener('click', () => container.classList.add("right-panel-active"));
if (signInMobileLink) signInMobileLink.addEventListener('click', () => container.classList.remove("right-panel-active"));

// ==========================================
// 2. إعدادات السيرفر 
// ==========================================
const API_BASE_URL = 'http://127.0.0.1:5000/api'; 

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
function showError(inputElement, message) {
    // تعيين رسالة الخطأ
    inputElement.setCustomValidity(message);
    // إظهار الرسالة للمستخدم
    inputElement.reportValidity();
    
    // بمجرد ما المستخدم يبدأ يكتب تاني، نشيل رسالة الخطأ
    inputElement.addEventListener('input', function clearError() {
        inputElement.setCustomValidity('');
        inputElement.removeEventListener('input', clearError);
    });
}

// ==========================================
// 3. دالة التوجيه
// ==========================================
function performLoginRedirect() {
    window.location.href = "../home/home.html";
}

// ==========================================
// 4. معالجة تسجيل حساب جديد
// ==========================================
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = signupForm.querySelector('button[type="submit"]');
        
        // جلب العناصر (Inputs)
        const nameInput = document.getElementById('signupName');
        const emailInput = document.getElementById('signupEmail');
        const phoneInput = document.getElementById('signupPhone');
        const passwordInput = document.getElementById('signupPassword');

        // تنظيف البيانات
        const name = escapeHTML(nameInput.value.trim());
        const email = escapeHTML(emailInput.value.trim());
        const phone = escapeHTML(phoneInput.value.trim());
        const password = passwordInput.value;

        // التحقق من الحقول الفارغة
        if(!name) { showError(nameInput, "Please enter your Full Name."); return; }
        if(!email) { showError(emailInput, "Please enter your Email Address."); return; }
        if(!phone) { showError(phoneInput, "Please enter your Phone Number."); return; }
        if(!password) { showError(passwordInput, "Please enter a Password."); return; }

        // التحقق من صحة الإيميل
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showError(emailInput, "Please enter a valid email address (e.g., example@gmail.com).");
            return;
        }

        // التحقق من رقم التليفون
        const phoneRegex = /^01[0125][0-9]{8}$/;
        if (!phoneRegex.test(phone)) {
            showError(phoneInput, "Please enter a valid Egyptian phone number.");
            return;
        }

        // التحقق من الباسورد
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            showError(passwordInput, "Password must be at least 8 characters long, contain uppercase, lowercase, number, and special character.");
            return;
        }

        // لو كله تمام، نعطل الزرار ونبعت للسيرفر
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Processing... <i class="fa fa-spinner fa-spin"></i>';

        try {
            const response = await fetch(`${API_BASE_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, password })
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message || 'Account created successfully!');
                container.classList.remove("right-panel-active");
                signupForm.reset();
            } else {
                // 🔴 التعديل هنا: عرض الخطأ على الحقل بناءً على رد السيرفر
                if (data.field === 'phone') {
                    showError(phoneInput, data.error);
                } else if (data.field === 'email') {
                    showError(emailInput, data.error);
                } else if (data.field === 'both') {
                    showError(emailInput, "This Email is already registered.");
                    showError(phoneInput, "This Phone number is already registered.");
                } else {
                    showError(emailInput, data.error || 'Signup failed'); 
                }
            }
        } catch (error) {
            console.error('Error:', error);
            showError(emailInput, 'Server error. Please ensure Flask is running.');
        } finally {
            resetButton(submitBtn, 'Sign up <i class="fa-solid fa-arrow-right"></i>');
        }
    });
}

// ==========================================
// 5. معالجة تسجيل الدخول
// ==========================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        const emailInput = document.getElementById('loginUsername') || document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');

        const email = escapeHTML(emailInput.value.trim());
        const password = passwordInput.value;

        if(!email) { showError(emailInput, "Please enter your Email."); return; }
        if(!password) { showError(passwordInput, "Please enter your Password."); return; }

        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Processing... <i class="fa fa-spinner fa-spin"></i>';

        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // حفظ الـ JWT
                if (data.token) {
                    localStorage.setItem('jwtToken', data.token); 
                    localStorage.setItem('customerId', data.customer_id); 
                    localStorage.setItem('customer_id', data.customer_id); 
                }

                window.location.href = "../home/home.html"; // توجيه مباشر بدون alert مزعج
            } else {
                // عرض رسالة الخطأ بتاعة تسجيل الدخول على حقل الباسورد
                showError(passwordInput, data.error || 'Invalid email or password'); 
            }
        } catch (error) {
            console.error('Error:', error);
            showError(emailInput, 'Connection failed. Is the server running?');
        } finally {
            resetButton(submitBtn, 'Login');
        }
    });
}

// دالة مساعدة لترجيع الزرار لحالته الأصلية
function resetButton(btn, originalText) {
    btn.disabled = false;
    btn.innerHTML = originalText;
}