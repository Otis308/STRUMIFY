const products = [
    {
        id: 1,
        name: "Guitar Acoustic Yamaha F310",
        category: "Acoustic",
        price: 3500000,
        originalPrice: 4000000,
        image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&h=300&fit=crop",
        description: "Guitar acoustic phổ biến cho người mới học, âm thanh ấm áp và cân bằng",
        rating: 4.5,
        reviews: 128,
        badge: "sale",
        specs: {
            brand: "Yamaha",
            type: "Acoustic",
            strings: "6 dây thép",
            color: "Nâu gỗ tự nhiên",
            warranty: "12 tháng"
        }
    },
    {
        id: 2,
        name: "Guitar Electric Fender Stratocaster",
        category: "Electric",
        price: 15000000,
        image: "https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=400&h=300&fit=crop",
        description: "Guitar điện cao cấp, âm thanh chuẩn rock, thiết kế iconic",
        rating: 5,
        reviews: 89,
        badge: "new",
        specs: {
            brand: "Fender",
            type: "Electric",
            strings: "6 dây điện",
            color: "Đen bóng",
            warranty: "24 tháng"
        }
    },
    {
        id: 3,
        name: "Guitar Classical Cordoba C5",
        category: "Classical",
        price: 8500000,
        image: "https://images.unsplash.com/photo-1556449895-a33c9dba33dd?w=400&h=300&fit=crop",
        description: "Guitar classical cho nhạc cổ điển và flamenco, âm sắc truyền thống",
        rating: 4.8,
        reviews: 56,
        specs: {
            brand: "Cordoba",
            type: "Classical",
            strings: "6 dây nylon",
            color: "Nâu gỗ",
            warranty: "12 tháng"
        }
    },
    {
        id: 4,
        name: "Guitar Bass Ibanez SR300E",
        category: "Bass",
        price: 12000000,
        originalPrice: 13500000,
        image: "https://images.unsplash.com/photo-1556449895-a33c9dba33dd?w=400&h=300&fit=crop",
        description: "Bass guitar 4 dây chất lượng cao, âm bass mạnh mẽ và rõ ràng",
        rating: 4.7,
        reviews: 45,
        badge: "sale",
        specs: {
            brand: "Ibanez",
            type: "Bass",
            strings: "4 dây bass",
            color: "Xanh dương",
            warranty: "18 tháng"
        }
    },
    {
        id: 5,
        name: "Guitar Acoustic Taylor 214ce",
        category: "Acoustic",
        price: 22000000,
        image: "https://images.unsplash.com/photo-1525201548942-d8732f6617a0?w=400&h=300&fit=crop",
        description: "Guitar acoustic cao cấp với pickup tích hợp, âm thanh tuyệt vời",
        rating: 5,
        reviews: 73,
        badge: "new",
        specs: {
            brand: "Taylor",
            type: "Acoustic-Electric",
            strings: "6 dây thép",
            color: "Nâu sáng",
            warranty: "24 tháng"
        }
    },
    {
        id: 6,
        name: "Guitar Electric Gibson Les Paul",
        category: "Electric",
        price: 45000000,
        image: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=400&h=300&fit=crop",
        description: "Guitar điện huyền thoại, âm thanh đậm đà cho rock và blues",
        rating: 5,
        reviews: 112,
        specs: {
            brand: "Gibson",
            type: "Electric",
            strings: "6 dây điện",
            color: "Sunburst",
            warranty: "24 tháng"
        }
    },
    {
        id: 7,
        name: "Guitar Acoustic Takamine GD20",
        category: "Acoustic",
        price: 6500000,
        originalPrice: 7200000,
        image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&h=300&fit=crop",
        description: "Guitar acoustic giá tốt, phù hợp cho người học và biểu diễn",
        rating: 4.3,
        reviews: 67,
        badge: "sale",
        specs: {
            brand: "Takamine",
            type: "Acoustic",
            strings: "6 dây thép",
            color: "Nâu vàng",
            warranty: "12 tháng"
        }
    },
    {
        id: 8,
        name: "Guitar Electric PRS SE Custom 24",
        category: "Electric",
        price: 18500000,
        image: "https://images.unsplash.com/photo-1564186763535-ebb21ef5277f?w=400&h=300&fit=crop",
        description: "Guitar điện chất lượng cao với thiết kế đẹp mắt và âm thanh đa năng",
        rating: 4.9,
        reviews: 94,
        badge: "new",
        specs: {
            brand: "PRS",
            type: "Electric",
            strings: "6 dây điện",
            color: "Violet",
            warranty: "24 tháng"
        }
    }
];

// Cart Management
let cart = JSON.parse(localStorage.getItem('guitarshop_cart')) || [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderProducts(products);
    updateCartUI();
    setupEventListeners();
});

// Render Products
function renderProducts(productsToRender) {
    const productsSection = document.getElementById('productsSection');
    productsSection.innerHTML = '';

    productsToRender.forEach(product => {
        const productCard = createProductCard(product);
        productsSection.appendChild(productCard);
    });
}

// Create Product Card
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const stars = '⭐'.repeat(Math.floor(product.rating)) + (product.rating % 1 ? '½' : '');
    const badgeHTML = product.badge ? `<div class="product-badge ${product.badge}">${product.badge === 'new' ? 'Mới' : 'Giảm giá'}</div>` : '';
    const originalPriceHTML = product.originalPrice ? `<span class="original-price">${formatPrice(product.originalPrice)}</span>` : '';
    
    card.innerHTML = `
        ${badgeHTML}
        <div class="product-image-container">
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <div class="quick-view" onclick="showProductModal(${product.id})">
                👁️ Xem chi tiết
            </div>
        </div>
        <div class="product-info">
            <div class="product-category">${product.category}</div>
            <h3 class="product-name">${product.name}</h3>
            <p class="product-description">${product.description}</p>
            <div class="product-rating">
                <span class="stars">${stars}</span>
                <span class="rating-count">(${product.reviews} đánh giá)</span>
            </div>
            <div class="product-specs">
                <span class="spec-tag">${product.specs.brand}</span>
                <span class="spec-tag">${product.specs.strings}</span>
                <span class="spec-tag">BH ${product.specs.warranty}</span>
            </div>
            <div class="product-footer">
                <div class="product-price">
                    <span class="current-price">${formatPrice(product.price)}</span>
                    ${originalPriceHTML}
                </div>
                <button class="add-to-cart-btn" onclick="addToCart(${product.id})">
                    🛒 Thêm
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// Format Price
function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

// Add to Cart
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }
    
    saveCart();
    updateCartUI();
    showNotification(`Đã thêm "${product.name}" vào giỏ hàng!`);
}

// Remove from Cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
}

// Update Quantity
function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            updateCartUI();
        }
    }
}

// Save Cart
function saveCart() {
    localStorage.setItem('guitarshop_cart', JSON.stringify(cart));
}

// Update Cart UI
function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    cartCount.textContent = totalItems;
    cartTotal.textContent = formatPrice(totalPrice);
    
    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <div class="empty-cart-icon">🛒</div>
                <p>Giỏ hàng trống</p>
                <p style="font-size: 0.9rem;">Hãy thêm sản phẩm vào giỏ hàng!</p>
            </div>
        `;
        checkoutBtn.disabled = true;
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${formatPrice(item.price)}</div>
                    <div class="quantity-control">
                        <button class="quantity-btn" onclick="updateQuantity(${item.id}, -1)">-</button>
                        <span class="quantity-display">${item.quantity}</span>
                        <button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
                    </div>
                </div>
                <button class="remove-item" onclick="removeFromCart(${item.id})">🗑️</button>
            </div>
        `).join('');
        checkoutBtn.disabled = false;
    }
}

// Toggle Cart
function toggleCart() {
    const cartSidebar = document.getElementById('cartSidebar');
    cartSidebar.classList.toggle('active');
}

// Show Product Modal
function showProductModal(productId) {
    const product = products.find(p => p.id === productId);
    const modal = document.getElementById('productModal');
    const modalBody = document.getElementById('modalBody');
    
    const stars = '⭐'.repeat(Math.floor(product.rating)) + (product.rating % 1 ? '½' : '');
    const originalPriceHTML = product.originalPrice ? 
        `<p style="text-decoration: line-through; color: #999;">${formatPrice(product.originalPrice)}</p>` : '';
    
    modalBody.innerHTML = `
        <div class="modal-product-grid">
            <div>
                <img src="${product.image}" alt="${product.name}" class="modal-image">
            </div>
            <div>
                <div class="product-category">${product.category}</div>
                <h2>${product.name}</h2>
                <div class="product-rating" style="margin: 1rem 0;">
                    <span class="stars">${stars}</span>
                    <span class="rating-count">(${product.reviews} đánh giá)</span>
                </div>
                <div style="margin: 1.5rem 0;">
                    <p style="font-size: 2rem; font-weight: bold; color: #ff6b35;">${formatPrice(product.price)}</p>
                    ${originalPriceHTML}
                </div>
                <p style="margin-bottom: 1.5rem; line-height: 1.8;">${product.description}</p>
                <button class="add-to-cart-btn" style="width: 100%; padding: 1rem;" onclick="addToCart(${product.id}); closeModal();">
                    🛒 Thêm vào giỏ hàng
                </button>
            </div>
        </div>
        <div>
            <h3 style="margin-bottom: 1rem;">Thông số kỹ thuật</h3>
            <ul class="modal-specs-list">
                ${Object.entries(product.specs).map(([key, value]) => `
                    <li>
                        <span class="spec-label">${getSpecLabel(key)}:</span>
                        <span class="spec-value">${value}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
    
    modal.classList.add('active');
}

// Get Spec Label
function getSpecLabel(key) {
    const labels = {
        brand: 'Thương hiệu',
        type: 'Loại',
        strings: 'Dây đàn',
        color: 'Màu sắc',
        warranty: 'Bảo hành'
    };
    return labels[key] || key;
}

// Close Modal
function closeModal() {
    document.getElementById('productModal').classList.remove('active');
}

// Show Notification
function showNotification(message) {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');
    
    notificationMessage.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Checkout
function checkout() {
    if (cart.length === 0) return;
    
    alert('Chức năng thanh toán đang được phát triển!\n\nTổng đơn hàng: ' + formatPrice(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)));
}

// Setup Event Listeners
function setupEventListeners() {
    // Category Filter
    document.getElementById('categoryFilter').addEventListener('change', (e) => {
        filterProducts();
    });
    
    // Price Sort
    document.getElementById('priceSort').addEventListener('change', (e) => {
        filterProducts();
    });
    
    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
        filterProducts();
    });
    
    // Close modal on overlay click
    document.getElementById('productModal').addEventListener('click', (e) => {
        if (e.target.id === 'productModal') {
            closeModal();
        }
    });
}

// Filter Products
function filterProducts() {
    const category = document.getElementById('categoryFilter').value;
    const priceSort = document.getElementById('priceSort').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    let filtered = [...products];
    
    // Filter by category
    if (category !== 'all') {
        filtered = filtered.filter(p => p.category === category);
    }
    
    // Filter by search
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            p.description.toLowerCase().includes(searchTerm) ||
            p.category.toLowerCase().includes(searchTerm)
        );
    }
    
    // Sort by price
    if (priceSort === 'low') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (priceSort === 'high') {
        filtered.sort((a, b) => b.price - a.price);
    }
    
    renderProducts(filtered);
}   