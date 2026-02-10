
    // Password toggle visibility
    const togglePassword = document.getElementById("togglePassword");
    const toggleConfirmPassword = document.getElementById(
    "toggleConfirmPassword",
    );
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");

    togglePassword.addEventListener("click", function () {
    togglePasswordVisibility(passwordInput, this);
    });

    toggleConfirmPassword.addEventListener("click", function () {
    togglePasswordVisibility(confirmPasswordInput, this);
    });

    function togglePasswordVisibility(input, button) {
    const type =
        input.getAttribute("type") === "password" ? "text" : "password";
    input.setAttribute("type", type);
    button.textContent = type === "password" ? "👁️" : "🙈";
    }

    // Password strength checker
    const strengthFill = document.getElementById("strengthFill");
    const strengthText = document.getElementById("strengthText");

    passwordInput.addEventListener("input", function () {
    const password = this.value;
    const strength = calculatePasswordStrength(password);

    strengthFill.className = "strength-fill";

    if (password.length === 0) {
        strengthFill.style.width = "0%";
        strengthText.textContent = "";
    } else if (strength < 3) {
        strengthFill.classList.add("strength-weak");
        strengthText.textContent = "Yếu";
        strengthText.style.color = "#f44336";
    } else if (strength < 5) {
        strengthFill.classList.add("strength-medium");
        strengthText.textContent = "Trung bình";
        strengthText.style.color = "#ff9800";
    } else {
        strengthFill.classList.add("strength-strong");
        strengthText.textContent = "Mạnh";
        strengthText.style.color = "#4caf50";
    }
    });

    function calculatePasswordStrength(password) {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return strength;
    }

    // Form validation
    const registerForm = document.getElementById("registerForm");
    const errorMessage = document.getElementById("errorMessage");
    const successMessage = document.getElementById("successMessage");

    registerForm.addEventListener("submit", function (e) {
    e.preventDefault();

    // Reset messages
    errorMessage.style.display = "none";
    successMessage.style.display = "none";
    clearErrors();

    // Get form values
    const formData = {
        fullName: document.getElementById("fullName").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value,
        confirmPassword: document.getElementById("confirmPassword").value,
        agreeTerms: document.getElementById("agreeTerms").checked,
    };

    // Validate
    let isValid = true;

    // Full name validation
    if (formData.fullName.length < 2) {
        showFieldError("fullName", "Họ tên phải có ít nhất 2 ký tự");
        isValid = false;
    }

    // Phone validation
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(formData.phone)) {
        showFieldError("phone", "Số điện thoại không hợp lệ (10-11 số)");
        isValid = false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        showFieldError("email", "Email không hợp lệ");
        isValid = false;
    }

    // Password validation
    if (formData.password.length < 6) {
        showError("Mật khẩu phải có ít nhất 6 ký tự");
        isValid = false;
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
        showFieldError("confirmPassword", "Mật khẩu xác nhận không khớp");
        isValid = false;
    }

    // Terms validation
    if (!formData.agreeTerms) {
        showError("Bạn phải đồng ý với điều khoản dịch vụ");
        isValid = false;
    }

    if (!isValid) return;

    // Submit form
    simulateRegister(formData);
    });

    function simulateRegister(formData) {
    const submitBtn = document.getElementById("submitBtn");
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Đang xử lý...";
    submitBtn.disabled = true;

    // Simulate API call
    setTimeout(() => {
        // Demo: Always succeed
        const userData = {
        ...formData,
        registeredAt: new Date().toISOString(),
        };

        // Store user (demo only)
        localStorage.setItem("guitarshop_new_user", JSON.stringify(userData));

        showSuccess("Đăng ký thành công! Đang chuyển đến trang đăng nhập...");

        // Redirect to login
        setTimeout(() => {
        window.location.href = "/";
        }, 2000);
    }, 1500);
    }

    function showFieldError(fieldName, message) {
    const input = document.getElementById(fieldName);
    const errorText = document.getElementById(fieldName + "Error");

    input.classList.add("input-error");
    errorText.textContent = message;
    errorText.style.display = "block";
    }

    function clearErrors() {
    document.querySelectorAll(".input-error").forEach((el) => {
        el.classList.remove("input-error");
    });
    document.querySelectorAll(".error-text").forEach((el) => {
        el.style.display = "none";
    });
    }

    function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = "block";
    errorMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = "block";
    successMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // Social register buttons
    document.querySelectorAll(".btn-social").forEach((button) => {
    button.addEventListener("click", function () {
        const platform = this.classList.contains("btn-google")
        ? "Google"
        : "Facebook";
        alert(`Chức năng đăng ký bằng ${platform} đang được phát triển!`);
    });
    });

    // Real-time validation on blur
    document.getElementById("phone").addEventListener("blur", function () {
    const phoneRegex = /^[0-9]{10,11}$/;
    if (this.value && !phoneRegex.test(this.value)) {
        showFieldError("phone", "Số điện thoại không hợp lệ");
    }
    });

    document.getElementById("email").addEventListener("blur", function () {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (this.value && !emailRegex.test(this.value)) {
        showFieldError("email", "Email không hợp lệ");
    }
    });

    document
    .getElementById("confirmPassword")
    .addEventListener("input", function () {
        const password = document.getElementById("password").value;
        if (this.value && this.value !== password) {
        showFieldError("confirmPassword", "Mật khẩu không khớp");
        } else {
        document
            .getElementById("confirmPassword")
            .classList.remove("input-error");
        document.getElementById("confirmPasswordError").style.display =
            "none";
        }
    });