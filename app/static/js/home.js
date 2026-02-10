
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const navLinks = document.getElementById("navLinks");

    mobileMenuBtn.addEventListener("click", () => {
    navLinks.classList.toggle("active");
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute("href"));
        if (target) {
        target.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
        // Close mobile menu if open
        navLinks.classList.remove("active");
        }
    });
    });

    // Add to cart functionality
    const buyButtons = document.querySelectorAll(".btn-buy");
    buyButtons.forEach((button) => {
    button.addEventListener("click", function () {
        const productCard = this.closest(".product-card");
        const productName = productCard.querySelector("h3").textContent;
        alert(
        `Đã thêm "${productName}" vào giỏ hàng!\n\nVui lòng đăng nhập để tiếp tục mua hàng.`,
        );
    });
    });

    // Header scroll effect
    let lastScroll = 0;
    const header = document.querySelector("header");

    window.addEventListener("scroll", () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > lastScroll && currentScroll > 100) {
        header.style.transform = "translateY(-100%)";
    } else {
        header.style.transform = "translateY(0)";
    }

    lastScroll = currentScroll;
    });

    // Add animation on scroll
    const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -100px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        }
    });
    }, observerOptions);

    // Observe all cards
    document
    .querySelectorAll(".feature-card, .product-card")
    .forEach((card) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(30px)";
        card.style.transition = "opacity 0.6s, transform 0.6s";
        observer.observe(card);
    });
