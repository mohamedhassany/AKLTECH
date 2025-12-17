// login.js

const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

// للموبايل
const signUpMobileLink = document.getElementById('signUpMobile');
const signInMobileLink = document.getElementById('signInMobile');

// حركات الأنيميشن للتنقل بين الدخول والتسجيل
if(signUpButton) {
    signUpButton.addEventListener('click', () => container.classList.add("right-panel-active"));
}
if(signInButton) {
    signInButton.addEventListener('click', () => container.classList.remove("right-panel-active"));
}
if(signUpMobileLink){
    signUpMobileLink.addEventListener('click', () => container.classList.add("right-panel-active"));
}
if(signInMobileLink){
    signInMobileLink.addEventListener('click', () => container.classList.remove("right-panel-active"));
}

// ==========================================
// 🔴 دالة التوجيه بعد تسجيل الدخول الناجح
// ==========================================
function performLoginRedirect() {
    // 1. نجيب الوضع اللي اختاره المستخدم في الصفحة الرئيسية
    const mode = localStorage.getItem('diningMode');

    // 2. لو كان حجز أو دليفري -> نوديه المنيو يكمل طلبه
    if (mode === "reservation" || mode === "delivery") {
        window.location.href = "../product/menu.html";
    } 
    // لو دخل بشكل مباشر أو أي حالة أخرى -> ممكن نوديه الصفحة الرئيسية أو المنيو برضه حسب رغبتك
    else {
        window.location.href = "../product/menu.html"; 
    }
}

// التعامل مع زر Login
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    // هنا المفروض كود التحقق من الباك إند
    // سنفترض أن الدخول نجح:
    alert('Welcome Back! Redirecting...');
    performLoginRedirect(); // استدعاء دالة التوجيه
});

// التعامل مع زر Sign Up
document.getElementById('signupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    // هنا كود إنشاء الحساب
    // سنفترض أن التسجيل نجح:
    alert('Account Created! Redirecting...');
    performLoginRedirect(); // استدعاء دالة التوجيه
});