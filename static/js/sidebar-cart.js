'use strict';

class CartSidebar {
  constructor() {
    this.cart = [];
    this.isOpen = false;
    this.isLoggedIn = false;
    this.apiBase = '';
    this.storageKey = 'strumify_cart';
    this.init();
  }

  init() {
    // 1. Detect logged in status
    this.checkLoginStatus();

    // 2. Load from localStorage (fallback)
    this.loadFromLocalStorage();
    this.updateBadge();

    // 3. Nếu login, fetch từ API (override local cart)
    if (this.isLoggedIn) {
      this.fetchFromAPI();
    }

    // 4. Render sidebar
    this.renderSidebar();

    // 5. Event listeners
    //this.attachEventListeners();
  }

  /* ── EVENT LISTENERS ─────────────────────────────────────────── */
  attachEventListeners() {
  }

  /* ── CHECK LOGIN STATUS ──────────────────────────────────────── */
  checkLoginStatus() {
    const token = localStorage.getItem('access_token');
    if (!token) {
      this.isLoggedIn = false;
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.isLoggedIn = payload.exp * 1000 > Date.now();
    } catch {
      this.isLoggedIn = false;
    }
  }

  /* ── LOAD FROM LOCALSTORAGE ──────────────────────────────────── */
  loadFromLocalStorage() {
    try {
      this.cart = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      // Normalize field names
      this.cart = this.cart.map(item => ({
        product_id:   item.product_id || item.id,
        product_name: item.product_name || item.name || '',
        price:        item.price || 0,
        image_url:    item.image_url || item.img || '',
        qty:          item.qty || item.quantity || 1,
        line_total:   item.line_total || (item.price * (item.qty || item.quantity || 1)),
      }));
    } catch (err) {
      console.warn('Cannot parse localStorage cart:', err);
      this.cart = [];
    }
  }

  /* ── FETCH FROM API ──────────────────────────────────────────– */
  async fetchFromAPI() {
    if (!this.isLoggedIn) return;

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${this.apiBase}/cart/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      this.cart = data.items || [];
      this.saveToLocalStorage();
      console.log('[CartSidebar] Fetched from API:', this.cart.length, 'items');
    } catch (err) {
      console.warn('[CartSidebar] Failed to fetch from API, using localStorage:', err);
    }
  }

  /* ── SAVE TO LOCALSTORAGE ────────────────────────────────────– */
  saveToLocalStorage() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.cart));
    this.updateBadge();
  }

  /* ── ADD ITEM ────────────────────────────────────────────────– */
  async addItem(productId, productName, price, imageUrl = null) {
    const existing = this.cart.find(x => x.product_id === productId);

    if (existing) {
      existing.qty += 1;
      existing.line_total = existing.price * existing.qty;
    } else {
      this.cart.push({
        product_id: productId,
        product_name: productName,
        price: price,
        image_url: imageUrl,
        qty: 1,
        line_total: price,
      });
    }

    this.saveToLocalStorage();
    this.renderSidebar();
    this.showSidebar();
    this.showToast(`✓ Đã thêm "${productName}" vào giỏ hàng`, 'success');

    // Sync to API if logged in
    if (this.isLoggedIn) {
      await this.syncAddToAPI(productId, 1);
    }
  }

  /* ── SYNC ADD TO API ─────────────────────────────────────────– */
  async syncAddToAPI(productId, quantity) {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      const res = await fetch(`${this.apiBase}/cart/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product_id: productId, quantity }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Sync failed');
      }

      console.log('[CartSidebar] Synced to API:', productId);
    } catch (err) {
      console.warn('[CartSidebar] Sync to API failed:', err);
      this.showToast('⚠ Giỏ hàng chưa lưu trên server', 'warning');
    }
  }

  /* ── REMOVE ITEM ─────────────────────────────────────────────– */
  async removeItem(idx) {
    if (!confirm('Xóa sản phẩm này khỏi giỏ hàng?')) return;

    this.cart.splice(idx, 1);
    this.saveToLocalStorage();
    this.renderSidebar();
    this.showToast('✓ Đã xóa sản phẩm', 'success');
  }

  /* ── RENDER SIDEBAR ──────────────────────────────────────────– */
  renderSidebar() {
    const sidebar = document.getElementById('cartSidebar');
    if (!sidebar) return;

    const isEmpty = this.cart.length === 0;
    const total = this.cart.reduce((s, x) => s + x.line_total, 0);

    sidebar.innerHTML = `
      <!-- Header -->
      <div class="cart-sidebar-header">
        <h3><i class="fa-solid fa-cart-shopping"></i> Giỏ hàng</h3>
        <button class="btn-close" type="button" aria-label="Đóng" onclick="cartSidebarInstance.hideSidebar()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Content -->
      <div class="cart-sidebar-content">
        ${isEmpty ? this.renderEmpty() : this.renderItems(total)}
      </div>

      <!-- Footer -->
      ${!isEmpty ? `
        <div class="cart-sidebar-footer">
          <div class="cart-total">
            <span>Tạm tính:</span>
            <span class="total-price">${this.formatPrice(total)}</span>
          </div>
          <a href="/cart" class="btn-checkout">
            <i class="fa-solid fa-arrow-right"></i> Tiến hành thanh toán
          </a>
        </div>
      ` : ''}
    `;
  }

  renderEmpty() {
    return `
      <div class="cart-empty">
        <div class="empty-icon"><i class="fa-solid fa-bag-shopping"></i></div>
        <h4>Giỏ hàng trống</h4>
        <p>Khám phá bộ sưu tập nhạc cụ của chúng tôi ngay hôm nay</p>
        <a href="/order" class="btn-browse">Khám phá sản phẩm</a>
      </div>
    `;
  }

  renderItems(total) {
    return `
      <div class="cart-items-list">
        ${this.cart.map((item, idx) => `
          <div class="cart-item-card">
            <div class="item-thumb" style="${item.image_url ? `background-image: url('${item.image_url}')` : 'background: linear-gradient(135deg, #f5ede4, #ead9c4); display: flex; align-items: center; justify-content: center;'} background-position: center; background-size: cover;">
              ${!item.image_url ? '<i class="fa-solid fa-guitar" style="font-size: 24px; color: #a08060;"></i>' : ''}
            </div>
            <div class="item-info">
              <div class="item-name">${item.product_name}</div>
              <div class="item-price">${this.formatPrice(item.price)} × <strong>${item.qty}</strong></div>
            </div>
            <button type="button" class="btn-remove" onclick="cartSidebarInstance.removeItem(${idx})" title="Xóa">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ── UTILITIES ───────────────────────────────────────────────– */
  updateBadge() {
    const total = this.cart.reduce((s, x) => s + x.qty, 0);
    document.querySelectorAll('.cart-badge, .badge-cart').forEach(el => {
      el.textContent = total;
      el.style.display = total > 0 ? 'block' : 'none';
    });
  }

  formatPrice(n) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(n || 0);
  }

  showSidebar() {
    const sidebar = document.getElementById('cartSidebar');
    const backdrop = document.getElementById('cartBackdrop');
    if (sidebar) sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    this.isOpen = true;
  }

  hideSidebar() {
    const sidebar = document.getElementById('cartSidebar');
    const backdrop = document.getElementById('cartBackdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    this.isOpen = false;
  }

  toggleSidebar() {
    if (this.isOpen) {
      this.hideSidebar();
    } else {
      this.showSidebar();
    }
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('cartToast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `cart-toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => toast.classList.remove('show'), 3500);
  }
}

/* ── GLOBAL INSTANCE ────────────────────────────────────────────– */
let cartSidebarInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize CartSidebar
  cartSidebarInstance = new CartSidebar();

  // Event: Click cart icon/button to toggle sidebar
  document.querySelectorAll('[data-toggle-cart]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      cartSidebarInstance.toggleSidebar();
    });
  });

  // Event: Add to cart buttons
  document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      // Check login first
      if (!cartSidebarInstance.isLoggedIn) {
        const currentUrl = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(currentUrl)}`;
        return;
      }

      // Extract data
      const productId = btn.dataset.productId;
      const productName = btn.dataset.productName;
      const price = parseFloat(btn.dataset.price);
      const imageUrl = btn.dataset.imageUrl || null;

      if (!productId || !productName || !price) {
        console.error('Missing product data:', { productId, productName, price });
        cartSidebarInstance.showToast('Lỗi: Dữ liệu sản phẩm không đầy đủ', 'error');
        return;
      }

      await cartSidebarInstance.addItem(productId, productName, price, imageUrl);
    });
  });

  // Close sidebar when clicking backdrop
  const backdrop = document.getElementById('cartBackdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      cartSidebarInstance.hideSidebar();
    });
  }

  console.log('[CartSidebar] Initialized successfully');
});

// Expose globally
window.CartSidebar = CartSidebar;