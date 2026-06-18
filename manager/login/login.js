document.addEventListener('DOMContentLoaded', () => {
    const API = "http://127.0.0.1:5000/login"; 
    const togglePassword = document.getElementById('togglePassword');
    const passwordField = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');

    // أزرار الثيم
    const themeBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const themeBtnCurtain = document.getElementById('theme-toggle-curtain');
    const themeIconCurtain = document.getElementById('theme-icon-curtain');

    // تأثير الستارة الترحيبية
    const enterBtn = document.getElementById('enter-btn');
    const welcomeCurtain = document.getElementById('welcome-curtain');
    const loginContainer = document.getElementById('login-container');

    // تشغيل الستارة السينمائية عند الضغط
    if (enterBtn && welcomeCurtain && loginContainer) {
        enterBtn.addEventListener('click', () => {
            welcomeCurtain.classList.add('slide-up');
            setTimeout(() => {
                loginContainer.classList.add('show');
            }, 300);
            setTimeout(() => {
                welcomeCurtain.style.display = 'none';
            }, 900);
        });
    }

    // إظهار وإخفاء الباسورد
if (togglePassword && passwordField) {
    togglePassword.addEventListener('click', function() {
        // تبديل نوع الحقل بين password و text
        const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordField.setAttribute('type', type);
        
        // تبديل شكل الأيقونة بشكل صحيح ومتوافق مع FontAwesome 6
        if (type === 'text') {
            this.classList.remove('fa-regular', 'fa-eye');
            this.classList.add('fa-solid', 'fa-eye-slash');
        } else {
            this.classList.remove('fa-solid', 'fa-eye-slash');
            this.classList.add('fa-regular', 'fa-eye');
        }
    });
}
    // نظام تبديل الثيم
    const toggleTheme = () => {
        const isLight = document.documentElement.classList.toggle('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        const icons = [themeIcon, themeIconCurtain];
        icons.forEach(icon => {
            if (icon) {
                if (isLight) {
                    icon.classList.replace('fa-moon', 'fa-sun');
                } else {
                    icon.classList.replace('fa-sun', 'fa-moon');
                }
            }
        });
    };

    if (document.documentElement.classList.contains('light-mode')) {
        if (themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
        if (themeIconCurtain) themeIconCurtain.classList.replace('fa-moon', 'fa-sun');
    }

    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    if (themeBtnCurtain) themeBtnCurtain.addEventListener('click', toggleTheme);

    // إدارة الأخطاء
    const showError = (msg) => {
        if (loginError) {
            const span = loginError.querySelector('span');
            if (span) span.textContent = msg;
            loginError.style.display = "flex"; 
        } else {
            alert(msg);
        }
    };

    const hideError = () => {
        if (loginError) loginError.style.display = "none";
    };

    // منطق اتصال الـ API وإرسال البيانات للباك إند
    const performLogin = async () => {
        hideError();

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');

        if (!usernameInput || !passwordInput) return;

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            return showError("Please fill username and password");
        }

        const originalBtnHtml = loginBtn.innerHTML;
        loginBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying...';
        loginBtn.disabled = true;

        try {
            const res = await fetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (data.success) {
                localStorage.setItem("manager", JSON.stringify({
                    staff_id: data.staff_id,
                    role: data.role,
                    name: data.name
                }));
                // الانتقال لصفحة الـ overview الداخلية للمانجر بعد نجاح اللوجن
                window.location.href = "../overveiw/overveiw.html";
            } else {
                showError(data.message || "Invalid username or password");
                loginBtn.innerHTML = originalBtnHtml;
                loginBtn.disabled = false;
            }
        } catch (err) {
            console.error("Login Error:", err);
            showError("Server error, please check connection.");
            loginBtn.innerHTML = originalBtnHtml;
            loginBtn.disabled = false;
        }
    };

    if (loginBtn) loginBtn.addEventListener('click', performLogin);

    // تفعيل الدخول بزر الـ Enter
    document.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            if (welcomeCurtain && welcomeCurtain.classList.contains('slide-up')) {
                performLogin();
            }
        }
    });
});