'use strict';

if (typeof window.CartSidebar === 'undefined') {

  class CartSidebar {
    constructor() {
      this.cart       = [];
      this.isOpen     = false;
      this.isLoggedIn = false;
      this.apiBase    = ''; 
      this.storageKey = 'strumify_cart';
      this.couponCode = '';
      this.discountAmount = 0;
      this.init();
    }

    getFallbackImage(item = {}) {
      const cat = String(item.cat || '').toLowerCase();
      const map = [
        { key: 'guitar', path: '/static/icons/home_guitar.jpg' },
        { key: 'violin', path: '/static/icons/home_violin.jpg' },
        { key: 'piano', path: '/static/icons/home_piano.jpg' },
        { key: 'drum', path: '/static/icons/home_drum.jpg' },
        { key: 'flute', path: '/static/icons/home_flute.jpg' },
        { key: 'ukulele', path: '/static/icons/home_ukulele.jpg' },
        { key: 'organ', path: '/static/icons/home_organs.jpg' },
      ];
      const found = map.find(x => cat.includes(x.key));
      if (found) return found.path;
      if (item.product_type === 'course') return '/static/icons/video_course/chant_course.jpg';
      return '/static/icons/home_guitar.jpg';
    }

    /* ── INIT ─────────────────────────────────────────────────────*/
    init() {
      this.checkLoginStatus();
      this.loadFromLocalStorage();
      this.updateBadge();

      if (this.isLoggedIn) {
        this.fetchFromAPI().then(() => {
          this.updateBadge();
          this.renderSidebar();
        });
      } else {
        this.renderSidebar();
      }
    }

    /* ── CHECK LOGIN ──────────────────────────────────────────────*/
    checkLoginStatus() {
      const token = localStorage.getItem('access_token');
      if (!token) { this.isLoggedIn = false; return; }
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.isLoggedIn = payload.exp * 1000 > Date.now();
      } catch {
        this.isLoggedIn = false;
      }
    }

    /* ── LOAD FROM LOCALSTORAGE (fallback only) ───────────────────*/
    loadFromLocalStorage() {
      try {
        const raw  = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        this.cart  = raw.map(item => ({
          id:           item.id           || null,
          product_id:   item.product_id   || item.id,
          product_name: item.product_name || item.name || '',
          price:        item.price        || 0,
          image_url:    item.image_url    || item.img  || this.getFallbackImage(item),
          qty:          item.qty          || item.quantity || 1,
          line_total:   item.line_total   || ((item.price || 0) * (item.qty || item.quantity || 1)),
          product_type: item.product_type || 'product',
          cat:          item.cat          || '',
        }));
      } catch {
        this.cart = [];
      }
    }

    /* ── FETCH FROM API (always called when logged in) ─────────── */
    async fetchFromAPI() {
      if (!this.isLoggedIn) return;
      try {
        const token = localStorage.getItem('access_token');
        const res   = await fetch(`${this.apiBase}/cart/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Normalize API response fields to match local format
        this.cart = (data.items || []).map(item => ({
          id:           item.id,
          product_id:   item.product_id,
          product_name: item.product_name || '',
          price:        item.price        || 0,
          image_url:    item.image_url    || this.getFallbackImage(item),
          qty:          item.quantity     || 1,
          line_total:   item.line_total   || (item.price * item.quantity),
          product_type: item.product_type || 'product',
          cat:          item.cat          || '',
        }));

        this.saveToLocalStorage();
      } catch (err) {
        console.warn('[CartSidebar] fetchFromAPI failed, using localStorage cache:', err);
      }
    }

    /* ── SAVE TO LOCALSTORAGE ─────────────────────────────────────*/
    saveToLocalStorage() {
      localStorage.setItem(this.storageKey, JSON.stringify(this.cart));
      this.updateBadge();
    }

    getSummary() {
      const itemsCount = this.cart.reduce((s, x) => s + (x.qty || 1), 0);
      const subtotal = this.cart.reduce((s, x) => s + (x.line_total || x.price * x.qty), 0);
      const discount = this.discountAmount > subtotal ? subtotal : this.discountAmount;
      const shipping = subtotal >= 3000000 || subtotal === 0 ? 0 : 30000;
      const total = Math.max(0, subtotal - discount + shipping);
      return { itemsCount, subtotal, discount, shipping, total };
    }

    applyCoupon() {
      const input = document.getElementById('sidebarCouponInput');
      const code = (input?.value || '').trim().toUpperCase();
      const subtotal = this.cart.reduce((s, x) => s + (x.line_total || x.price * x.qty), 0);
      if (!code) return;

      if (code === 'MOC10') {
        this.couponCode = code;
        this.discountAmount = Math.round(subtotal * 0.1);
        this.showToast('Áp dụng mã MOC10 thành công', 'success');
      } else {
        this.couponCode = '';
        this.discountAmount = 0;
        this.showToast('Mã giảm giá không hợp lệ', 'error');
      }
      this.renderSidebar();
    }

    closeSidebar() {
      this.hideSidebar();
    }

    /* ── ADD ITEM (called from order.js) ─────────────────────────*/
    async addItem(productId, productName, price, imageUrl = null, productType = 'product') {
      const existing = this.cart.find(x => x.product_id === productId);
      if (existing) {
        existing.qty       += 1;
        existing.line_total = existing.price * existing.qty;
      } else {
        this.cart.push({
          id:           null,
          product_id:   productId,
          product_name: productName,
          price:        price,
          image_url:    imageUrl || this.getFallbackImage({ product_type: productType }),
          qty:          1,
          line_total:   price,
          product_type: productType,
          cat:          '',
        });
      }
      this.saveToLocalStorage();
      this.renderSidebar();
      await this.showSidebar();

      // Sync to API if logged in
      if (this.isLoggedIn) {
        await this.syncAddToAPI(productId, 1);
        // Re-fetch to get real cart item IDs
        await this.fetchFromAPI();
        this.renderSidebar();
      }
    }

    /* ── SYNC ADD TO API ──────────────────────────────────────────*/
    async syncAddToAPI(productId, quantity) {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      try {
        const res = await fetch(`${this.apiBase}/cart/add`, {
          method:  'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({ product_id: productId, quantity }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Sync failed');
        }
      } catch (err) {
        console.warn('[CartSidebar] syncAddToAPI failed:', err);
        this.showToast('⚠ Không thể lưu giỏ hàng trên server', 'warning');
      }
    }

    /* ── REMOVE ITEM (calls DELETE /cart/{id} on API) ─────────── */
    async removeItem(idx, cartItemId = null) {
      const confirmed = confirm('Xóa sản phẩm này khỏi giỏ hàng?');
      if (!confirmed) return;

      this.cart.splice(idx, 1);
      this.saveToLocalStorage();
      this.renderSidebar();
      this.showToast('✓ Đã xóa sản phẩm', 'success');

      // Sync delete to API
      if (this.isLoggedIn && cartItemId) {
        const token = localStorage.getItem('access_token');
        try {
          await fetch(`${this.apiBase}/cart/${cartItemId}`, {
            method:  'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type':  'application/json',
            },
          });
        } catch (err) {
          console.warn('[CartSidebar] removeItem API failed:', err);
        }
      }
    }

    /* ── RENDER SIDEBAR ───────────────────────────────────────────*/
    renderSidebar() {
      const sidebar = document.getElementById('cartSidebar');
      if (!sidebar) return;

      const isEmpty = this.cart.length === 0;
      const summary = this.getSummary();

      sidebar.innerHTML = `
        <div class="cart-sidebar-header">
          <h3><i class="fa-solid fa-bag-shopping"></i> Giỏ hàng </h3>
          <button class="btn-close-sidebar" type="button" onclick="cartSidebarInstance.hideSidebar()" aria-label="Đóng">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="cart-sidebar-content">
          ${isEmpty ? this.renderEmpty() : this.renderItems()}
        </div>

        ${!isEmpty ? `
          <div class="cart-sidebar-footer">

            <div class="sidebar-price-summary">
              <div class="sidebar-summary-row"><span>Số lượng sản phẩm:</span><strong>${summary.itemsCount}</strong></div>
              <div class="sidebar-summary-row"><span>Tạm tính:</span><strong>${this.formatPrice(summary.subtotal)}</strong></div>
              <div class="sidebar-summary-row sidebar-summary-discount" style="display:${summary.discount > 0 ? 'flex' : 'none'}">
                <span>Giảm giá:</span><strong>- ${this.formatPrice(summary.discount)}</strong>
              </div>
              <div class="sidebar-summary-row"><span>Phí vận chuyển:</span><strong>${summary.shipping === 0 ? 'Miễn phí' : this.formatPrice(summary.shipping)}</strong></div>
              <div class="sidebar-summary-row sidebar-summary-total">
                <span><strong>Tổng thanh toán:</strong></span>
                <strong class="sidebar-summary-total-value">${this.formatPrice(summary.total)}</strong>
              </div>
            </div>

            <a href="/cart" class="btn-goto-checkout sidebar-btn-checkout">
              <i class="fa-solid fa-lock"></i>&nbsp;Thanh toán ngay
            </a>
            <button type="button" onclick="cartSidebarInstance.closeSidebar()"
                    class="btn-continue-shopping sidebar-btn-continue">
              <i class="fa-solid fa-arrow-left"></i>&nbsp;Tiếp tục mua sắm
            </button>
          </div>
        ` : ''}
      `;
    }

    renderEmpty() {
      return `
        <div class="cart-empty-state">
          <div class="empty-icon-wrap">
            <i class="fa-solid fa-bag-shopping"></i>
          </div>
          <h4>Giỏ hàng trống</h4>
          <p>Hãy khám phá bộ sưu tập nhạc cụ tuyệt vời của chúng tôi!</p>
          <a href="/order" class="btn-explore" onclick="cartSidebarInstance.hideSidebar()">
            <i class="fa-solid fa-guitar"></i> Khám phá sản phẩm
          </a>
          ${!this.isLoggedIn ? `
            <div class="login-hint">
              <i class="fa-solid fa-circle-info"></i>
              <a href="/login">Đăng nhập</a> để lưu giỏ hàng trên mọi thiết bị
            </div>` : ''}
        </div>
      `;
    }

    renderItems() {
      const featuredPromos = [
        { code: 'MOC10', label: 'Giảm 10%', color: '#16a34a' },
        { code: 'NEWUSER', label: 'Khách mới −15%', color: '#0284c7' },
        { code: 'GUITAR50', label: 'Giảm 500K', color: '#9333ea' },
      ];

      return `
        <div class="cart-items-list">
          ${this.cart.map((item, idx) => `
            <div class="cart-item-card" id="cartRow${idx}">
              ${item.image_url
                ? `<img class="item-thumb" src="${item.image_url}" alt="${item.product_name}" loading="lazy"
                        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : ''}
              <div class="item-thumb item-thumb-placeholder" style="${item.image_url ? 'display:none' : 'display:flex'}">
                <i class="fa-solid ${item.product_type === 'course' ? 'fa-graduation-cap' : 'fa-guitar'}"></i>
              </div>
              <div class="item-info">
                <div class="item-name" title="${item.product_name || ''}">${item.product_name || 'Sản phẩm'}</div>
                <div class="item-price">
                  <strong>${this.formatPrice(item.line_total || item.price * item.qty)}</strong>
                  <span> × ${item.qty || 1}</span>
                </div>
              </div>
              <button class="btn-remove" onclick="cartSidebarInstance.removeItem(${idx}, ${item.id || 'null'})" title="Xóa">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          `).join('')}
        </div>
      `;
    }

    /* ── UTILITIES ────────────────────────────────────────────────*/
    updateBadge() {
      const total = this.cart.reduce((s, x) => s + (x.qty || 1), 0);
      document.querySelectorAll('.cart-badge, .badge-cart, #cartCount').forEach(el => {
        el.textContent   = total;
        el.style.display = total > 0 ? 'flex' : 'none';
      });
    }

    formatPrice(n) {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency', currency: 'VND',
      }).format(n || 0);
    }

    /* ── SHOW / HIDE ──────────────────────────────────────────────*/
    async showSidebar() {
      const sidebar  = document.getElementById('cartSidebar');
      const backdrop = document.getElementById('cartBackdrop');

      // Open immediately with cached data for instant feedback
      if (sidebar)  sidebar.classList.add('open');
      if (backdrop) backdrop.classList.add('open');
      this.isOpen = true;

      // Show current state
      this.renderSidebar();

      // Then refresh from API in background (if logged in)
      if (this.isLoggedIn) {
        await this.fetchFromAPI();
        this.renderSidebar();
        this.updateBadge();
      }
    }

    hideSidebar() {
      const sidebar  = document.getElementById('cartSidebar');
      const backdrop = document.getElementById('cartBackdrop');
      if (sidebar)  sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
      this.isOpen = false;
    }

    async toggleSidebar() {
      if (this.isOpen) {
        this.hideSidebar();
      } else {
        await this.showSidebar();
      }
    }

    showToast(message, type = 'info') {
      const toast = document.getElementById('cartToast');
      if (!toast) return;
      toast.textContent  = message;
      toast.className    = `cart-toast ${type}`;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3500);
    }

    showSidebarQuick() {
      const sidebar  = document.getElementById('cartSidebar');
      const backdrop = document.getElementById('cartBackdrop');
      if (sidebar)  sidebar.classList.add('open');
      if (backdrop) backdrop.classList.add('open');
      this.isOpen = true;
      this.renderSidebar();
    }
  }

  /* ── GLOBAL INSTANCE ──────────────────────────────────────────────*/
  // Khai báo instance trên window để các onclick trong HTML có thể gọi được
  window.cartSidebarInstance = null;

  document.addEventListener('DOMContentLoaded', () => {
    // Chỉ khởi tạo 1 lần
    if (!window.cartSidebarInstance) {
      window.cartSidebarInstance = new CartSidebar();
    }

    const cartInstance = window.cartSidebarInstance;

    document.querySelectorAll('[data-toggle-cart]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        await cartInstance.toggleSidebar();
      });
    });

    const backdrop = document.getElementById('cartBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => cartInstance.hideSidebar());
    }

    document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();

        if (!cartInstance.isLoggedIn) {
          const next = window.location.pathname + window.location.search;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }

        const productId   = btn.dataset.productId;
        const productName = btn.dataset.productName;
        const price       = parseFloat(btn.dataset.price);
        const imageUrl    = btn.dataset.imageUrl || null;

        if (!productId || !productName || !price) {
          cartInstance.showToast('Lỗi: Thiếu thông tin sản phẩm', 'error');
          return;
        }

        await cartInstance.addItem(Number(productId), productName, price, imageUrl);
      });
    });

    console.log('[CartSidebar v2] Initialized');
  });

  /* ── FIX: Expose functions globally ──*/
  window.toggleCart = async () => {
    if (window.cartSidebarInstance) await window.cartSidebarInstance.toggleSidebar();
  };

  // Đánh dấu là đã khai báo để vòng lặp if bên ngoài bắt được ở lần gọi sau
  window.CartSidebar = CartSidebar;
}