// تأثير الكتابة (Typewriter)
const textElement = document.querySelector('.typewriter-text');
const originalText = "WELCOME TO THE AKLTECH SYSTEM"; 
// تأكدنا من النص الثابت لتجنب الأخطاء عند إعادة تحميل الصفحة
let charIndex = 0;

function typeWriter() {
    if (charIndex < originalText.length) {
        textElement.textContent = originalText.slice(0, charIndex + 1);
        charIndex++;
        setTimeout(typeWriter, 50); // سرعة الكتابة
    }
}

// تشغيل الكتابة عند تحميل الصفحة
if(textElement) {
    textElement.textContent = ""; // تفريغ النص في البداية
    typeWriter();
}

// إظهار الزر بعد فترة
setTimeout(function() {
    const button = document.querySelector('.animated-button');
    if (button) {
        button.classList.add('visible');
    }
}, 2240); // تقليل الوقت قليلاً لتحسين التجربة

// وظيفة اختيار نوع الطعام
function selectDiningMode(mode) {
    // 1. حفظ الاختيار
    localStorage.setItem('diningMode', mode);

    // 2. التوجيه
    if (mode === "reservation" || mode === "delivery") {
        window.location.href = "../login/login.html";
    } else {
        window.location.href = "../product/menu.html";
    }
}

// وظيفة القائمة للموبايل (Hamburger Menu)
function toggleMenu() {
    const nav = document.querySelector('.navig');
    nav.classList.toggle('active');
}