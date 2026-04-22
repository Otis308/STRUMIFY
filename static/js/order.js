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
  const API_BASE = 'http://127.0.0.1:8000'; 

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
  window.openProductModal = function (id) {
  const pData = _getProductData(id);
  const modal = document.getElementById('productModal');
  const body  = document.getElementById('modalBody');
  if (!modal || !body) return;

  if (!pData) {
    showToast('Không tìm thấy dữ liệu sản phẩm', 'err');
    return;
  }

  if (pData) {
    // Xây dựng HTML specs
    let specsHTML = '';
    if (pData.specs && Object.keys(pData.specs).length) {
      const specsEntries = Object.entries(pData.specs)
        .filter(([, v]) => v && String(v).toLowerCase() !== 'none');
      
      if (specsEntries.length > 0) {
        specsHTML = `
          <div class="modal-specs-section">
            <h4 class="specs-title"><i class="fa-solid fa-list-check"></i> Thông Số Kỹ Thuật</h4>
            <div class="specs-grid">
              ${specsEntries.map(([k, v]) => {
                const upper = String(k || '').toUpperCase();
                const label = (typeof specsTranslation !== 'undefined'
                  && specsTranslation
                  && specsTranslation[upper])
                  ? specsTranslation[upper]
                  : k;
                return `
                  <div class="spec-row">
                    <span class="spec-label">${label}</span>
                    <span class="spec-value">${v}</span>
                  </div>`;
              }).join('')}
            </div>
          </div>`;
      }
    }

    body.innerHTML = `
      <div class="modal-header-close">
        <button class="modal-close-btn" onclick="closeModal()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="modal-grid">
        <div class="modal-img-wrap">
          <div class="modal-img-container">
            ${pData.image_url
              ? `<img class="modal-img" src="${pData.image_url}" alt="${pData.name}" loading="lazy">`
              : `<div class="modal-img-placeholder">
                   <i class="fa-solid fa-guitar"></i>
                   <p>Không có ảnh</p>
                 </div>`}
          </div>
        </div>
        
        <div class="modal-info">
          <div class="modal-content-inner">
            <p class="product-category">${pData.category || pData.cat || 'Nhạc cụ'}</p>
            <h2 class="modal-product-name">${pData.name}</h2>
            
            <div class="modal-rating">
              <span class="stars-display">★★★★★</span>
              <span class="rating-text">4.9 (94 đánh giá)</span>
            </div>

            <div class="modal-price-block">
              <p class="current-price">${fmt(pData.price)}</p>
              ${pData.orig && pData.orig > pData.price
                ? `<p class="original-price">${fmt(pData.orig)}</p>` : ''}
            </div>

            ${pData.description ? `
              <div class="modal-desc-box">
                <p class="modal-desc">${pData.description}</p>
              </div>` : ''}

            <button class="modal-add-btn" onclick="addToCart(${pData.id}, ${pData.price}); closeModal()">
              <i class="fa-solid fa-cart-plus"></i> Thêm Vào Giỏ Hàng
            </button>
          </div>
        </div>
      </div>

      ${specsHTML}
    `;
  }
  modal.style.display = 'flex';
  modal.classList.add('active');
};

  window.closeModal = function() {
    const m = document.getElementById('productModal');
    if (!m) return;
    m.classList.remove('active');
    setTimeout(() => { m.style.display = 'none'; }, 200);
  };
  window.handleModalOverlayClick = function(e) {
    if (e.target.id === 'productModal') window.closeModal();
  };

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