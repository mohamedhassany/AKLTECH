// ==========================================
// 1. إعدادات الصفحة عند التحميل (Navbar & Animations)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    // --- تحديث الـ Navbar بناءً على حالة تسجيل الدخول ---
    const navLinks = document.getElementById("nav-links");
    const customerId = localStorage.getItem("customerId") || localStorage.getItem("customer_id"); // ضفت دي احتياطي عشان لو متسجلة بالاسم التاني

    // التأكد إن عنصر الروابط موجود في الصفحة
    if (navLinks) {
        if (customerId) {
            // لو المستخدم مسجل دخول
            navLinks.innerHTML = `
                <li><a href="../profile/profile.html">My Profile</a></li>
                <li><a href="../tracking/tracking.html">Tracking</a></li>
                <li><a href="../feedback/feedback.html">Feedback</a></li>
                <li><a href="#about-us">About us</a></li>
                <li><a href="#" onclick="logoutUser(event)" style="color:red;">Logout</a></li>
            `;
        } else {
            // لو المستخدم مش مسجل دخول
            navLinks.innerHTML = `
                <li><a href="../login/login.html">Register</a></li>
                <li><a href="../tracking/tracking.html">Tracking</a></li>
                <li><a href="../feedback/feedback.html">Feedback</a></li>
                <li><a href="#about-us">About us</a></li>
                <li><a href="#footerr">Contact us</a></li>
            `;
        }
    }

    // --- تأثير الكتابة (Typewriter) ---
    // ... (باقي كود الجافاسكريبت بتاعك زي ما هو بدون تغيير)

    // --- تأثير الكتابة (Typewriter) ---
    const textElement = document.querySelector('.typewriter-text');
    const originalText = "WELCOME TO THE AKLTECH SYSTEM"; 
    let charIndex = 0;

    function typeWriter() {
        if (charIndex < originalText.length) {
            textElement.textContent = originalText.slice(0, charIndex + 1);
            charIndex++;
            setTimeout(typeWriter, 50); // سرعة الكتابة
        }
    }

    // تشغيل الكتابة عند تحميل الصفحة لو العنصر موجود
    if (textElement) {
        textElement.textContent = ""; // تفريغ النص في البداية
        typeWriter();
    }

    // --- إظهار الزر بعد فترة ---
    setTimeout(() => {
        const button = document.querySelector('.animated-button');
        if (button) {
            button.classList.add('visible');
        }
    }, 2240); // تقليل الوقت قليلاً لتحسين التجربة
});

// ==========================================
// 2. الدوال العامة (Global Functions)
// ==========================================

// دالة تسجيل الخروج
window.logoutUser = function(event) {
    // منع الصفحة من عمل Scroll لو اللينك عبارة عن #
    if (event) event.preventDefault(); 
    
    // مسح بيانات العميل من المتصفح
    localStorage.removeItem("customerId");
    localStorage.removeItem("customer_id"); // ضفت دي عشان يمسح النسختين
    localStorage.removeItem("diningMode");
    
    // إعادة التوجيه للصفحة الرئيسية
    window.location.href = "../home/home.html";
};

// وظيفة اختيار نوع الطعام
window.selectDiningMode = function(mode) {
    // 1. حفظ الاختيار في المتصفح
    localStorage.setItem('diningMode', mode);

    // 2. التأكد من حالة تسجيل الدخول
    const isLoggedIn = localStorage.getItem("customerId");

    // 3. التوجيه المنطقي
    // لو "مش مسجل دخول" واختار (حجز أو دليفري) -> يروح يسجل دخول
    if (!isLoggedIn && (mode === "reservation" || mode === "delivery")) {
        window.location.href = "../login/login.html";
    } 
    // لو مسجل دخول جاهز، أو اختار حاجة تانية (Dine-in / Take-away) -> يروح للمنيو مباشرة
    else {
        window.location.href = "../product/menu.html";
    }
};

// وظيفة القائمة للموبايل (Hamburger Menu)
window.toggleMenu = function() {
    const nav = document.querySelector('.navig');
    if (nav) {
        nav.classList.toggle('active');
    }
};