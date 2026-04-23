/* ================================================================
   STRUMIFY – order.js  (Compatible with sidebar-cart.js)

   PHÂN CÔNG TRÁCH NHIỆM:
     order.js         → Product grid (filter/sort/search), product modal,
                        addToCart() gọi API, bridge với cartSidebarInstance
     sidebar-cart.js  → Quản lý toàn bộ cart state, render sidebar,
                        badge count, sync API

   LUỒNG DỮ LIỆU:
     User click "+" → addToCart() → POST /cart/add → cartSidebarInstance
                    .fetchFromAPI() → renderSidebar() → updateBadge()
   ================================================================ */
'use strict';
{ 
  const API_BASE = '';

  const specsTranslation = {
  'BRAND': 'THƯƠNG HIỆU',
  'TOP': 'MẶT ĐÀN',
  'WARRANTY': 'BẢO HÀNH',
  'STRINGS': 'DÂY ĐÀN',
  'TYPE': 'LOẠI',
  'BODY': 'THÂN ĐÀN',
  'PICKUPS': 'PICKUP',
  'COLOR': 'MÀU SẮC',
  'FRETS': 'PHÍM',
};

  /* ================================================================
    AUTH HELPERS
    ================================================================ */
  function getToken()   { return localStorage.getItem('access_token') || ''; }
  function isLoggedIn() {
    const token = getToken();
    if (!token) return false;
    try {
      const p = JSON.parse(atob(token.split('.')[1]));
      return p.exp * 1000 > Date.now();
    } catch { return false; }
  }
  function authHeaders() {
    return {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${getToken()}`,
    };
  }

  /* ================================================================
    FORMAT
    ================================================================ */
  function fmt(n) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
  }
  function _getProductData(id) {
    if (typeof PRODUCT_DATA === 'undefined') return null;
    const target = Number(id);
    return PRODUCT_DATA.find((p) => {
      const pid = Number(p.id);
      if (!Number.isNaN(target) && !Number.isNaN(pid)) return pid === target;
      return String(p.id) === String(id);
    }) || null;
  }

  /* ================================================================
    TOAST – Delegate sang cartSidebarInstance nếu có
    ================================================================ */
  let _toastTimer = null;
  function showToast(msg, type = 'info') {
    if (window.cartSidebarInstance?.showToast) {
      const mapped = type === 'ok' ? 'success' : type === 'err' ? 'error' : 'info';
      window.cartSidebarInstance.showToast(msg, mapped);
      return;
    }
    const el   = document.getElementById('toastNotification');
    const icon = document.getElementById('toastIcon');
    const text = document.getElementById('toastText');
    if (!el) { console.info('[Toast]', msg); return; }
    if (icon) icon.textContent = type === 'ok' ? '✓' : type === 'err' ? '✕' : 'ℹ';
    if (text) text.textContent = msg;
    el.className = `toast-notification show ${type === 'ok' ? 'success' : type === 'err' ? 'error' : ''}`;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  /* ================================================================
    GUEST MODAL
    Auto-inject vào DOM nếu order.html chưa có #guestModal
    ================================================================ */
  function _ensureGuestModal() {
    if (document.getElementById('guestModal')) return;
    const nextParam = encodeURIComponent(window.location.pathname + window.location.search);
    const div = document.createElement('div');
    div.id        = 'guestModal';
    div.className = 'modal-overlay';  
    div.style.cssText = 'display:none;position:fixed;inset:0;z-index:5000;'
      + 'background:rgba(0,0,0,.55);backdrop-filter:blur(6px);'
      + 'align-items:center;justify-content:center;padding:20px';
    div.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:36px 28px;
                  max-width:400px;width:100%;text-align:center;
                  box-shadow:0 24px 60px rgba(0,0,0,.25)">
        <div style="width:56px;height:56px;border-radius:50%;
                    background:linear-gradient(135deg,#5c3d22,#8c5a30);
                    display:flex;align-items:center;justify-content:center;
                    margin:0 auto 16px;font-size:22px;color:#f5e4c0">
          <i class="fa-solid fa-lock"></i>
        </div>
        <h3 style="font-family:'Playfair Display',serif;font-size:1.3rem;
                  color:#2a1a0e;margin-bottom:8px">Yêu cầu đăng nhập</h3>
        <p style="color:#8a6f55;font-size:13.5px;line-height:1.6;margin-bottom:22px">
          Bạn cần đăng nhập để thêm sản phẩm vào giỏ hàng
        </p>
        <a href="/login?next=${nextParam}"
          style="display:inline-flex;align-items:center;gap:8px;
                  padding:12px 28px;background:linear-gradient(135deg,#5c3d22,#8c5a30);
                  color:#f5e4c0;border-radius:11px;font-weight:700;
                  text-decoration:none;font-size:14px;font-family:Nunito,sans-serif">
          <i class="fa-solid fa-right-to-bracket"></i> Đăng nhập ngay
        </a>
        <button id="guestModalClose"
                style="display:block;width:100%;margin-top:10px;padding:10px;
                      border:1.5px solid #ead9c4;background:none;border-radius:11px;
                      cursor:pointer;font-family:Nunito,sans-serif;
                      font-size:13px;color:#8a6f55">
          Để sau
        </button>
      </div>`;
    document.body.appendChild(div);

    /* Đóng khi click backdrop hoặc nút Để sau */
    div.addEventListener('click', (e) => {
      if (e.target === div) _closeGuestModal();
    });
    div.querySelector('#guestModalClose')?.addEventListener('click', _closeGuestModal);
  }

  function _openGuestModal() {
    _ensureGuestModal();
    const m = document.getElementById('guestModal');
    if (!m) return;
    m.style.display = 'flex';
    requestAnimationFrame(() => m.classList.add('active'));
  }
  function _closeGuestModal() {
    const m = document.getElementById('guestModal');
    if (!m) return;
    m.classList.remove('active');
    setTimeout(() => { m.style.display = 'none'; }, 220);
  }

  function _initSidebarClassBridge() {
    const sidebar = document.getElementById('cartSidebar');
    if (!sidebar) return;

    let _syncing = false; 
    const observer = new MutationObserver(() => {
      if (_syncing) return;
      _syncing = true;

      const hasOpen   = sidebar.classList.contains('open');
      const hasActive = sidebar.classList.contains('active');

      if (hasOpen && !hasActive) sidebar.classList.add('active');
      if (!hasOpen && hasActive) sidebar.classList.remove('active');

      /* Sync overlay: order.html dùng #cartOverlay, sidebar-cart.js dùng #cartBackdrop */
      const overlay  = document.getElementById('cartOverlay');
      const backdrop = document.getElementById('cartBackdrop');
      const isOpen   = sidebar.classList.contains('open');
      if (overlay)  overlay.classList.toggle('active', isOpen);
      if (backdrop) backdrop.classList.toggle('open',  isOpen);

      _syncing = false;
    });

    observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
  }

  window.toggleCart = async function() {
    if (window.cartSidebarInstance) {
      await window.cartSidebarInstance.toggleSidebar();
      /* _initSidebarClassBridge() sẽ tự động sync .active */
      return;
    }

    /* Fallback khi cartSidebarInstance chưa khởi tạo xong */
    const sidebar  = document.getElementById('cartSidebar');
    const overlay  = document.getElementById('cartOverlay')
                  || document.getElementById('cartBackdrop');
    if (!sidebar) return;

    const willOpen = !sidebar.classList.contains('active');
    sidebar.classList.toggle('active', willOpen);
    sidebar.classList.toggle('open',   willOpen);
    if (overlay) overlay.classList.toggle('active', willOpen);
    document.body.style.overflow = willOpen ? 'hidden' : '';
  };

  window.addToCart = async function(id, price) {
    if (!isLoggedIn()) {
      _openGuestModal();
      return;
    }
    const productId = Number(id);
    const btn = document.querySelector(`.product-card[data-id="${id}"] .add-to-cart-btn`)
            || document.querySelector(`.product-card[data-id="${id}"] [onclick*="addToCart"]`);

    if (btn) {
      btn.disabled    = true;
      btn.innerHTML   = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
      const res = await fetch(`${API_BASE}/cart/add`, {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({ product_id: productId, quantity: 1 }),
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/dbca24f3-a3f9-4862-a266-6b2c853c41b6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'368463'},body:JSON.stringify({sessionId:'368463',runId:'pre-fix',hypothesisId:'F1',location:'order.js:addToCart:afterFetch',message:'Response metadata from /cart/add',data:{status:res.status,ok:res.ok,contentType:res.headers.get('content-type')||'',productId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const rawText = await res.text();
      let data = {};
      if (contentType.includes('application/json')) {
        try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = {}; }
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/dbca24f3-a3f9-4862-a266-6b2c853c41b6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'368463'},body:JSON.stringify({sessionId:'368463',runId:'pre-fix',hypothesisId:'F2',location:'order.js:addToCart:parseBody',message:'Parsed body from /cart/add',data:{isJson:contentType.includes('application/json'),textPrefix:(rawText||'').slice(0,80)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (!res.ok) {
        const msg = (data && (data.detail || data.message)) || rawText || 'Không thể thêm vào giỏ hàng';
        showToast(msg, 'err');
        return;
      }

      const successMsg = `✓ ${data.message || 'Đã thêm vào giỏ hàng'}`;

      if (window.cartSidebarInstance) {
        /* Refresh data từ API → render sidebar mới nhất */
        await window.cartSidebarInstance.fetchFromAPI();
        window.cartSidebarInstance.updateBadge();
        window.cartSidebarInstance.showSidebarQuick();
        /* Đảm bảo .active cũng được set (do CSS bridge) */
        document.getElementById('cartSidebar')?.classList.add('active');
        window.cartSidebarInstance.showToast(successMsg, 'success');
      } else {
        /* Fallback: tự mở sidebar thủ công */
        const sidebar = document.getElementById('cartSidebar');
        const overlay = document.getElementById('cartOverlay')
                      || document.getElementById('cartBackdrop');
        if (sidebar) {
          sidebar.classList.add('active', 'open');
          document.body.style.overflow = 'hidden';
        }
        if (overlay) overlay.classList.add('active');
        showToast(successMsg, 'ok');
      }

      /* Visual feedback trên card */
      const card = document.querySelector(`.product-card[data-id="${id}"]`);
      if (card) {
        card.classList.add('just-added');
        setTimeout(() => card.classList.remove('just-added'), 1400);
      }

    } catch (err) {
      console.error('[addToCart]', err);
      showToast('Lỗi kết nối máy chủ. Vui lòng thử lại!', 'err');
    } finally {
      if (btn) {
        btn.disabled  = false;
        btn.innerHTML = '<i class="fa-solid fa-plus"></i>';
      }
    }
  };

  /* ================================================================
    CHECKOUT
    ================================================================ */
  window.openCheckout = function() {
    if (!isLoggedIn()) { _openGuestModal(); return; }
    window.location.href = '/cart';
  };

  /* ================================================================
    COUPON – Hiển thị xác nhận, dùng thực sự khi checkout tại /cart
    ================================================================ */
  const _COUPONS = {
    'MOC10':    { label: 'Giảm 10%' },
    'MOC20':    { label: 'Giảm 20%' },
    'NEWUSER':  { label: 'Khách mới −15%' },
    'GUITAR50': { label: 'Giảm 500.000₫' },
    'VIP25':    { label: 'VIP −25%' },
  };

  window.applyCoupon = function() {
    const input = document.getElementById('couponInput');
    const msgEl = document.getElementById('couponMsg');
    const code  = (input?.value || '').trim().toUpperCase();
    if (!code) return;
    if (_COUPONS[code]) {
      if (msgEl) {
        msgEl.textContent = `✓ ${_COUPONS[code].label} – Sử dụng tại trang thanh toán`;
        msgEl.className   = 'coupon-msg ok';
      }
      showToast(`Mã "${code}" hợp lệ! Áp dụng khi đặt hàng.`, 'ok');
      /* Lưu vào sessionStorage để cart.js dùng lại */
      sessionStorage.setItem('pending_coupon', code);
    } else {
      if (msgEl) { msgEl.textContent = 'Mã không hợp lệ'; msgEl.className = 'coupon-msg err'; }
    }
  };

  /* ================================================================
    MODAL CHI TIẾT SẢN PHẨM
    ================================================================ */
    function _buildStarsHTML(rating) {
      const r     = parseFloat(rating) || 0;
      const full  = Math.floor(r);
      const half  = r - full >= 0.5 ? 1 : 0;
      const empty = 5 - full - half;
      let html = '<div class="pd-stars">';
      for (let i = 0; i < full;  i++) html += '<i class="fa-solid fa-star"></i>';
      if (half)                        html += '<i class="fa-solid fa-star-half-stroke"></i>';
      for (let i = 0; i < empty; i++) html += '<i class="fa-regular fa-star"></i>';
      return html + '</div>';
    }
   
    /**
     * Tạo HTML bảng thông số kỹ thuật từ object specs.
     * Tự động dịch key sang tiếng Việt qua specsTranslation map.
     * Lọc bỏ các giá trị null / "none" / rỗng.
     */
    function _buildSpecsHTML(specs) {
      if (!specs || typeof specs !== 'object') return '';
   
      const entries = Object.entries(specs)
        .filter(([, v]) => v && String(v).trim().toLowerCase() !== 'none' && String(v).trim() !== '')
        .map(([k, v]) => ({
          label: specsTranslation[String(k).toUpperCase()] || k,
          value: v,
        }));
   
      if (!entries.length) return '';
   
      return `
        <div class="pd-specs-section">
          <h4 class="pd-specs-title">
            <i class="fa-solid fa-list-check"></i> Thông số kỹ thuật
          </h4>
          <div class="pd-specs-grid">
            ${entries.map(({ label, value }) => `
              <div class="pd-spec-item">
                <span class="pd-spec-label">${label}</span>
                <span class="pd-spec-value">${value}</span>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
   
    /* ── WISHLIST (localStorage persist) ─────────────────────────── */
    function _getWishlist() {
      try { return new Set(JSON.parse(localStorage.getItem('moc_wishlist') || '[]')); }
      catch { return new Set(); }
    }
    function _saveWishlist(set) {
      localStorage.setItem('moc_wishlist', JSON.stringify([...set]));
    }
   
    /* ── PUBLIC: Toggle yêu thích ────────────────────────────────── */
    window.toggleWishlist = function (id, btn) {
      const numId   = Number(id);
      const wishlist = _getWishlist();
      const icon    = btn.querySelector('i');
      const isNow   = wishlist.has(numId);
   
      if (isNow) {
        wishlist.delete(numId);
        icon.className = 'fa-regular fa-heart';
        btn.classList.remove('wished');
        btn.title = 'Thêm vào yêu thích';
        showToast('Đã bỏ khỏi danh sách yêu thích', 'info');
      } else {
        wishlist.add(numId);
        icon.className = 'fa-solid fa-heart';
        btn.classList.add('wished');
        btn.title = 'Bỏ yêu thích';
        showToast('Đã thêm vào yêu thích ❤', 'ok');
        /* Hiệu ứng scale khi like */
        btn.style.transform = 'scale(1.4)';
        setTimeout(() => { btn.style.transform = ''; }, 280);
      }
      _saveWishlist(wishlist);
    };
   
    /* ── PUBLIC: Qty controller ──────────────────────────────────── */
    window.pdDecQty = function (id) {
      const inp = document.getElementById(`pdQty-${id}`);
      if (!inp) return;
      inp.value = Math.max(1, (parseInt(inp.value) || 1) - 1);
    };
   
    window.pdIncQty = function (id) {
      const inp = document.getElementById(`pdQty-${id}`);
      if (!inp) return;
      inp.value = Math.min(99, (parseInt(inp.value) || 1) + 1);
    };
   
    window.pdClampQty = function (inp) {
      let v = parseInt(inp.value) || 1;
      inp.value = Math.max(1, Math.min(99, v));
    };
   
    /* ── PUBLIC: Add to cart từ modal (có qty) ───────────────────── */
    window.pdAddToCart = async function (id, price) {
      const qty = parseInt(document.getElementById(`pdQty-${id}`)?.value) || 1;
   
      if (!isLoggedIn()) { _openGuestModal(); return; }
   
      const btn = document.getElementById('pdAddBtn');
      if (btn) {
        btn.disabled  = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang thêm…';
      }
   
      try {
        const res = await fetch(`${API_BASE}/cart/add`, {
          method:  'POST',
          headers: authHeaders(),
          body:    JSON.stringify({ product_id: Number(id), quantity: qty }),
        });
   
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        let data = {};
        if (contentType.includes('application/json')) {
          try { data = await res.json(); } catch {}
        }
   
        if (!res.ok) {
          showToast(data.detail || data.message || 'Không thể thêm vào giỏ hàng', 'err');
          return;
        }
   
        const msg = `✓ ${data.message || `Đã thêm ${qty} sản phẩm`}`;
        closeModal();
   
        if (window.cartSidebarInstance) {
          await window.cartSidebarInstance.fetchFromAPI();
          window.cartSidebarInstance.updateBadge();
          window.cartSidebarInstance.showSidebarQuick();
          document.getElementById('cartSidebar')?.classList.add('active');
          window.cartSidebarInstance.showToast(msg, 'success');
        } else {
          showToast(msg, 'ok');
          const sidebar = document.getElementById('cartSidebar');
          const overlay = document.getElementById('cartOverlay')
                       || document.getElementById('cartBackdrop');
          if (sidebar) { sidebar.classList.add('active', 'open'); }
          if (overlay) overlay.classList.add('active');
        }
   
        /* Visual feedback trên card */
        const card = document.querySelector(`.product-card[data-id="${id}"]`);
        if (card) {
          card.classList.add('just-added');
          setTimeout(() => card.classList.remove('just-added'), 1400);
        }
   
      } catch (err) {
        console.error('[pdAddToCart]', err);
        showToast('Lỗi kết nối. Vui lòng thử lại!', 'err');
      } finally {
        if (btn) {
          btn.disabled  = false;
          btn.innerHTML = '<i class="fa-solid fa-cart-plus"></i> Thêm vào giỏ';
        }
      }
    };
   
    /* ── PUBLIC: Mua ngay → add + redirect /cart ─────────────────── */
    window.pdBuyNow = async function (id, price) {
      await window.pdAddToCart(id, price);
      /* Nếu thêm thành công (modal đã đóng), redirect sang /cart */
      setTimeout(() => { window.location.href = '/cart'; }, 350);
    };
   
    /* ═══════════════════════════════════════════════════════════════
      openProductModal  – Entry point chính
      Được gọi từ onclick="openProductModal({{ product.id }})" trong HTML
     ═══════════════════════════════════════════════════════════════ */
    window.openProductModal = function (id) {
      const pData = _getProductData(id);
      const modal = document.getElementById('productModal');
      const body  = document.getElementById('modalBody');
      if (!modal || !body) return;
   
      if (!pData) {
        showToast('Không tìm thấy dữ liệu sản phẩm', 'err');
        return;
      }
   
      /* ── Tính toán dữ liệu ──────────────────────────────────────── */
      const rating   = parseFloat(pData.rating) || 0;
      const reviews  = parseInt(pData.reviews)  || 0;
      const discount = (pData.orig && pData.orig > pData.price)
        ? Math.round((1 - pData.price / pData.orig) * 100) : 0;
      const savings  = (pData.orig && pData.orig > pData.price)
        ? fmt(pData.orig - pData.price) : null;
   
      const wishlist  = _getWishlist();
      const isWished  = wishlist.has(Number(pData.id));
   
      /* Trạng thái tồn kho:
         DB hiện không có cột stock → mặc định "Còn hàng".
         Khi bạn thêm cột stock vào DB, thay `true` bằng `(pData.stock || 0) > 0`.
      */
      const inStock = true;
   
      /* ── Build HTML ─────────────────────────────────────────────── */
      body.innerHTML = `
        <!-- Nút đóng modal -->
        <button class="pd-close" onclick="closeModal()" aria-label="Đóng">
          <i class="fa-solid fa-xmark"></i>
        </button>
   
        <!-- GRID CHÍNH: 2 cột (Desktop) / 1 cột (Mobile) -->
        <div class="pd-grid">
   
          <!-- ══ CỘT TRÁI: Hình ảnh ══════════════════════════════ -->
          <div class="pd-img-col">
            <div class="pd-img-main">
              ${pData.image_url
                ? `<img
                    src="${pData.image_url}"
                    alt="${pData.name}"
                    loading="lazy"
                    onerror="this.onerror=null;this.style.display='none';
                             this.nextElementSibling.style.display='flex'"
                  />`
                : ''
              }
              <div class="pd-img-ph" style="${pData.image_url ? 'display:none' : ''}">
                <i class="fa-solid fa-guitar"></i>
                <span>Chưa có ảnh</span>
              </div>
            </div>
   
            ${discount > 0 ? `
              <div class="pd-discount-ribbon">
              </div>` : ''}
          </div>
   
          <!-- ══ CỘT PHẢI: Thông tin sản phẩm ════════════════════ -->
          <div class="pd-info-col">
   
            <!-- 1. Tags danh mục + thương hiệu -->
            <div class="pd-tags">
              ${pData.cat   ? `<span class="pd-tag-cat">${pData.cat}</span>`     : ''}
              ${pData.brand ? `<span class="pd-tag-brand">${pData.brand}</span>` : ''}
            </div>
   
            <!-- 2. Tên sản phẩm -->
            <h2 class="pd-name">${pData.name}</h2>
   
            <!-- 3. Rating + Số lượt đánh giá + Nút Wishlist (cùng 1 hàng) -->
            <div class="pd-rating-row">
              ${_buildStarsHTML(rating)}
              <span class="pd-rating-num">
                ${rating > 0 ? rating.toFixed(1) : 'Chưa có'}
              </span>
              ${reviews > 0 ? `<span class="pd-review-cnt">(${reviews} đánh giá)</span>` : ''}
   
              <!-- Nút yêu thích với hiệu ứng toggle -->
              <button
                class="pd-wishlist-btn ${isWished ? 'wished' : ''}"
                id="pdWishBtn-${pData.id}"
                onclick="toggleWishlist(${pData.id}, this)"
                title="${isWished ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}"
                aria-label="${isWished ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}"
              >
                <i class="${isWished ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
              </button>
            </div>
   
            <!-- 4. Giá bán + Giá gốc gạch chéo -->
            <div class="pd-price-block">
              <span class="pd-price-main">${fmt(pData.price)}</span>
              ${pData.orig && pData.orig > pData.price ? `
                <span class="pd-price-orig">${fmt(pData.orig)}</span>
                ${savings ? `<span class="pd-price-badge">Tiết kiệm ${savings}</span>` : ''}
              ` : ''}
            </div>
   
            <!-- 5. Badge trạng thái tồn kho -->
            <div class="pd-stock-badge ${inStock ? 'in-stock' : 'out-stock'}">
              <i class="fa-solid ${inStock ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
              <span>${inStock ? 'Còn hàng – Giao hàng toàn quốc' : 'Tạm hết hàng'}</span>
            </div>
   
            <!-- 6. Mô tả ngắn -->
            ${pData.description ? `
              <p class="pd-desc">${pData.description}</p>
            ` : ''}
   
            <!-- 7. Điều khiển số lượng -->
            ${inStock ? `
              <div class="pd-qty-section">
                <span class="pd-qty-label">Số lượng:</span>
                <div class="pd-qty-ctrl">
                  <button
                    class="pd-qty-btn"
                    onclick="pdDecQty(${pData.id})"
                    aria-label="Giảm số lượng"
                  >−</button>
                  <input
                    type="number"
                    class="pd-qty-input"
                    id="pdQty-${pData.id}"
                    value="1"
                    min="1"
                    max="99"
                    onchange="pdClampQty(this)"
                    onkeyup="pdClampQty(this)"
                    aria-label="Số lượng"
                  />
                  <button
                    class="pd-qty-btn"
                    onclick="pdIncQty(${pData.id})"
                    aria-label="Tăng số lượng"
                  >+</button>
                </div>
              </div>
            ` : ''}
   
            <!-- 8. CTA Buttons -->
            <div class="pd-actions">
              ${inStock ? `
                <button
                  class="pd-btn-add"
                  id="pdAddBtn"
                  onclick="pdAddToCart(${pData.id}, ${pData.price})"
                >
                  <i class="fa-solid fa-cart-plus"></i> Thêm vào giỏ
                </button>
                <button
                  class="pd-btn-buy"
                  onclick="pdBuyNow(${pData.id}, ${pData.price})"
                >
                  <i class="fa-solid fa-bolt"></i> Mua ngay
                </button>
              ` : `
                <button class="pd-btn-add disabled" disabled>
                  <i class="fa-solid fa-clock"></i> Tạm hết hàng
                </button>
              `}
            </div>
   
            <!-- 9. Cam kết dịch vụ nhỏ -->
            <div class="pd-guarantees">
              <div class="pd-guarantee-item">
                <i class="fa-solid fa-shield-halved"></i>
                <span>Bảo hành chính hãng</span>
              </div>
              <div class="pd-guarantee-item">
                <i class="fa-solid fa-truck-fast"></i>
                <span>Giao hàng toàn quốc</span>
              </div>
              <div class="pd-guarantee-item">
                <i class="fa-solid fa-rotate-left"></i>
                <span>Đổi trả 7 ngày</span>
              </div>
            </div>
   
          </div>
          <!-- /pd-info-col -->
        </div>
        <!-- /pd-grid -->
   
        <!-- SPECS TABLE ở dưới grid, full-width -->
        ${_buildSpecsHTML(pData.specs)}
      `;
   
      /* Show modal với animation */
      modal.style.display = 'flex';
      requestAnimationFrame(() => modal.classList.add('active'));
   
      /* Khóa scroll body khi modal mở */
      document.body.style.overflow = 'hidden';
    };
   
    /* ── closeModal & overlay click ─────────────────────────────── */
    window.closeModal = function () {
      const m = document.getElementById('productModal');
      if (!m) return;
      m.classList.remove('active');
      document.body.style.overflow = '';
      /* Đợi transition kết thúc rồi mới display:none */
      setTimeout(() => { m.style.display = 'none'; }, 220);
    };
   
    window.handleModalOverlayClick = function (e) {
      /* Chỉ đóng khi click vào chính backdrop, không phải modal-box */
      if (e.target.id === 'productModal') window.closeModal();
    };
   
    /* ── Đóng modal bằng phím Escape ────────────────────────────── */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const m = document.getElementById('productModal');
        if (m && m.classList.contains('active')) window.closeModal();
      }
    });
 
    
  /* ================================================================
    LỌC – TÌM KIẾM – SẮP XẾP
    ================================================================ */
  let allCards = [];

  function filterAndSort() {
    const selCat  = (document.getElementById('categoryFilter')?.value || 'all').toLowerCase();
    const sortVal =  document.getElementById('priceSort')?.value || 'default';
    const keyword = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const section =  document.getElementById('productsSection');
    const cntEl   =  document.getElementById('resultsCount');

    /* Bước 1: Lọc theo category + search */
    let visible = allCards.filter(card => {
      const cat  = (card.getAttribute('data-category') || '').toLowerCase();
      const name = (card.querySelector('.product-name')?.textContent || '').toLowerCase();
      return (selCat === 'all' || cat === selCat)
          && (!keyword || name.includes(keyword));
    });

    /* Bước 2: Lọc badge (sale/hot/new/limited) */
    if (['sale', 'hot', 'new', 'limited'].includes(sortVal)) {
      visible = visible.filter(c => c.querySelector(`.badge-${sortVal}`) !== null);
    }

    /* Bước 3: Sắp xếp giá */
    if (sortVal === 'low')  visible.sort((a, b) => _getCardPrice(a) - _getCardPrice(b));
    if (sortVal === 'high') visible.sort((a, b) => _getCardPrice(b) - _getCardPrice(a));

    /* Bước 4: Render */
    allCards.forEach(c => { c.style.display = 'none'; c.classList.remove('fade-in-up'); });
    visible.forEach((card, i) => {
      card.style.display = 'flex';
      section?.appendChild(card);
      setTimeout(() => card.classList.add('fade-in-up'), i * 30);
    });

    /* Bước 5: Cập nhật counter */
    if (cntEl) cntEl.innerHTML = `Tìm thấy <strong>${visible.length}</strong> sản phẩm`;

    /* Bước 6: No-results message */
    let noResult = section?.querySelector('.no-products-msg');
    if (!visible.length) {
      if (!noResult) {
        noResult = document.createElement('div');
        noResult.className = 'no-products-msg';
        noResult.style.cssText = 'grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)';
        noResult.innerHTML = `
          <i class="fa-solid fa-magnifying-glass"
            style="font-size:2.5rem;opacity:.3;display:block;margin-bottom:12px"></i>
          <p>Không tìm thấy sản phẩm phù hợp</p>
          <button onclick="document.getElementById('categoryFilter').value='all';filterAndSort()"
                  style="margin-top:12px;padding:8px 20px;border-radius:8px;
                        border:1px solid currentColor;cursor:pointer;
                        background:none;color:inherit;font-family:inherit">
            Xem tất cả
          </button>`;
        section?.appendChild(noResult);
      }
    } else {
      noResult?.remove();
    }
  }

  function _getCardPrice(card) {
    const t = card.querySelector('.product-price')?.textContent || '0';
    return parseInt(t.replace(/[^\d]/g, ''), 10) || 0;
  }

  /* ================================================================
    KHỞI TẠO
    ================================================================ */
  document.addEventListener('DOMContentLoaded', () => {

    /* 1. Snapshot tất cả product cards */
    allCards = Array.from(document.querySelectorAll('.product-card'));

    /* 2. Khởi động CSS bridge – phải gọi trước khi user tương tác */
    _initSidebarClassBridge();

    /* 3. Inject guest modal sẵn vào DOM */
    _ensureGuestModal();

    /* 4. Filter / sort listeners */
    document.getElementById('searchInput')?.addEventListener('input', filterAndSort);
    document.getElementById('priceSort')?.addEventListener('change', filterAndSort);
    document.getElementById('categoryFilter')?.addEventListener('change', () => {
      const val = document.getElementById('categoryFilter').value;
      document.querySelectorAll('.cat-tab').forEach(t =>
        t.classList.toggle('active', t.getAttribute('data-cat') === val));
      filterAndSort();
    });

    /* 5. Category tab clicks */
    document.querySelectorAll('.cat-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const cat = tab.getAttribute('data-cat');
        const sel = document.getElementById('categoryFilter');
        if (sel) sel.value = cat;
        filterAndSort();
        document.getElementById('productsSection')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    /* 6. URL query params */
    const urlCat    = new URLSearchParams(window.location.search).get('cat');
    const urlSearch = new URLSearchParams(window.location.search).get('search');

    if (urlCat) {
      const sel = document.getElementById('categoryFilter');
      if (sel) sel.value = urlCat;
      document.querySelectorAll('.cat-tab').forEach(t =>
        t.classList.toggle('active', t.getAttribute('data-cat') === urlCat));
    }
    if (urlSearch) {
      const inp = document.getElementById('searchInput');
      if (inp) inp.value = urlSearch;
    }

    filterAndSort();

    /* 7. Pay option radio (checkout modal cũ – kept for backward compat) */
    document.querySelectorAll('.pay-option').forEach(opt => {
      opt.onclick = () => {
        document.querySelectorAll('.pay-option').forEach(o => {
          o.classList.remove('selected');
          const r = o.querySelector('input[type=radio]');
          if (r) r.checked = false;
        });
        opt.classList.add('selected');
        const radio = opt.querySelector('input[type=radio]');
        if (radio) radio.checked = true;
        const coPayM = document.getElementById('coPayMethod');
        if (coPayM) coPayM.value = opt.getAttribute('data-method');
        const bd = document.getElementById('bankDetails');
        if (bd) bd.style.display = opt.getAttribute('data-method') === 'bank' ? 'block' : 'none';
      };
    });

    /* 8. Đóng guestModal khi click backdrop */
    document.getElementById('guestModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'guestModal') _closeGuestModal();
    });

    /* 9. Đảm bảo cartSidebarInstance đã ready trước khi user click */
    if (!window.cartSidebarInstance) {
      console.warn('[order.js] cartSidebarInstance chưa sẵn sàng. '
        + 'Đảm bảo sidebar-cart.js được load trước order.js.');
    }
  });

  /* ================================================================
    CSS: Inject style bổ sung cho .just-added feedback trên card
    ================================================================ */
  (function injectOrderStyles() {
    if (document.getElementById('order-js-styles')) return;
    const style = document.createElement('style');
    style.id = 'order-js-styles';
    style.textContent = `
      /* Sync: sidebar-cart.js dùng .open, order.css dùng .active
        Bridge trong _initSidebarClassBridge() tự động sync,
        nhưng CSS này đảm bảo .open cũng hoạt động độc lập */
      .cart-sidebar.open {
        right: 0 !important;
      }
      .cart-overlay.active,
      #cartBackdrop.open {
        display: block !important;
      }

      /* Visual feedback khi vừa thêm vào giỏ */
      .product-card.just-added {
        outline: 2.5px solid var(--gold, #c9922a);
        outline-offset: 2px;
        transition: outline 0.2s ease;
      }

      /* Guest modal animation */
      #guestModal {
        transition: opacity .22s ease;
        opacity: 0;
      }
      #guestModal.active {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  })();
}