/**
 * GuitarShop Login Logic
 * Cập nhật: 10/02/2026
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Elements Selection
    const loginForm = document.getElementById("loginForm");
    const togglePassword = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");
    const emailInput = document.getElementById("email");
    const errorMessage = document.getElementById("errorMessage");
    const successMessage = document.getElementById("successMessage");
    const submitButton = loginForm.querySelector('button[type="submit"]');

    // 2. Kiểm tra trạng thái đăng nhập khi load trang
    checkExistingLogin();

    // 3. Toggle Password Visibility
    togglePassword.addEventListener("click", function () {
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        this.textContent = isPassword ? "🙈" : "👁️";
    });

    // 4. Form Submission
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        resetMessages();

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const rememberMe = document.getElementById("rememberMe").checked;

        // Validation logic
        if (!validateForm(email, password)) return;

        // Bắt đầu quá trình đăng nhập
        setLoading(true);

        try {
            // Thay thế URL này bằng endpoint thực tế của FastAPI (ví dụ: /api/v1/login)
            const response = await handleLoginRequest(email, password);

            if (response.success) {
                saveUserData(response.user, rememberMe);
                showStatus(successMessage, "Đăng nhập thành công! Đang chuyển hướng...");
                
                // Chuyển hướng sau 1.2s
                setTimeout(() => {
                    window.location.href = "/home";
                }, 1200);
            } else {
                showStatus(errorMessage, response.message || "Email hoặc mật khẩu không chính xác!");
                setLoading(false);
            }
        } catch (error) {
            showStatus(errorMessage, "Lỗi kết nối máy chủ. Vui lòng thử lại sau!");
            setLoading(false);
            console.error("Login Error:", error);
        }
    });

    // --- Helper Functions ---

    async function handleLoginRequest(email, password) {
        /**
         * Ở đây bạn sẽ dùng fetch() để gọi đến Backend FastAPI của mình.
         * Demo giả lập phản hồi từ server:
         */
        return new Promise((resolve) => {
            setTimeout(() => {
                // Logic test: Chấp nhận mọi pass >= 6 ký tự
                if (password.length >= 6) {
                    resolve({
                        success: true,
                        user: { email, token: "JWT_TOKEN_HERE", name: "User" }
                    });
                } else {
                    resolve({ success: false, message: "Mật khẩu không hợp lệ!" });
                }
            }, 1000);
        });
    }

    function validateForm(email, password) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^[0-9]{10,11}$/;

        if (!email) return showStatus(errorMessage, "Vui lòng nhập email hoặc số điện thoại!");
        if (!password) return showStatus(errorMessage, "Vui lòng nhập mật khẩu!");
        if (password.length < 6) return showStatus(errorMessage, "Mật khẩu phải có ít nhất 6 ký tự!");
        if (!emailRegex.test(email) && !phoneRegex.test(email)) {
            return showStatus(errorMessage, "Định dạng email hoặc số điện thoại không hợp lệ!");
        }
        return true;
    }

    function saveUserData(user, rememberMe) {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem("guitarshop_user", JSON.stringify({
            ...user,
            loginAt: new Date().toISOString()
        }));
    }

    function checkExistingLogin() {
        const saved = localStorage.getItem("guitarshop_user") || sessionStorage.getItem("guitarshop_user");
        if (saved) {
            const userData = JSON.parse(saved);
            emailInput.value = userData.email;
            // Tùy chọn: Có thể tự động redirect nếu token còn hạn
            console.log("Welcome back:", userData.email);
        }
    }

    function setLoading(isLoading) {
        submitButton.disabled = isLoading;
        submitButton.innerHTML = isLoading 
            ? '<span class="spinner"></span> Đang xác thực...' 
            : "Đăng Nhập";
    }

    function showStatus(element, message) {
        element.textContent = message;
        element.style.display = "block";
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return false;
    }

    function resetMessages() {
        errorMessage.style.display = "none";
        successMessage.style.display = "none";
    }
});