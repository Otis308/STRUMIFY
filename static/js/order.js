/* ================================================================
   STRUMIFY – order.js  (Trang sản phẩm /order)
   Data Flow:
     1. Guest → Xem tự do. Bấm "Thêm vào giỏ" → popup đăng nhập
     2. Logged in → Thêm vào giỏ (localStorage), hiện sidebar cart
     3. Checkout → Redirect sang /cart
   ================================================================ */
'use strict';

/* ── CONFIG ──────────────────────────────────────────────────── */
const CART_KEY = 'strumify_cart';
const API_BASE = '';

const COUPONS = {
  'MOC10':    { type: 'percent', value: 10,        label: 'Giảm 10%' },
  'MOC20':    { type: 'percent', value: 20,        label: 'Giảm 20%' },
  'NEWUSER':  { type: 'percent', value: 15,        label: 'Khách mới −15%' },
  'GUITAR50': { type: 'fixed',   value: 500_000,   label: 'Giảm 500.000₫' },
  'VIP25':    { type: 'percent', value: 25,        label: 'VIP −25%' },
};

const BANK = {
  bankBin:     '970422',
  accountNo:   '89779799999',
  accountName: 'CONG TY STRUMIFY INSTRUMENT',
  bankFull:    'MB Bank',
};

/* ── AUTH ────────────────────────────────────────────────────── */
function getToken() { return localStorage.getItem('access_token') || ''; }

function isLoggedIn() {
  const token = getToken();
  if (!token) return false;
  try {
    const p = JSON.parse(atob(token.split('.')[1]));
    return p.exp * 1000 > Date.now();
  } catch { return false; }
}

/* ── CART: localStorage ──────────────────────────────────────── */
function _loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
  catch { return []; }
}

function _saveCart(cartArr) {
  localStorage.setItem(CART_KEY, JSON.stringify(cartArr));
  const total = cartArr.reduce((s, x) => s + x.qty, 0);
  document.querySelectorAll('.cart-badge, .cart-count').forEach(el => {
    el.textContent    = total;
    el.style.display  = total > 0 ? 'inline-flex' : 'none';
  });
}

function _getProductData(id) {
  if (typeof PRODUCT_DATA === 'undefined') return null;
  return PRODUCT_DATA.find(p => p.id === Number(id)) || null;
}

/* ── FORMAT ──────────────────────────────────────────────────── */
function fmt(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
}

/* ── TOAST ───────────────────────────────────────────────────── */
let _toastTimer = null;
function showToast(msg, type = 'info') {
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
   1. THÊM VÀO GIỎ HÀNG
   Data Flow: Guest bị chặn → hiện popup login
   ================================================================ */
window.addToCart = function (id, price) {
  /* Data Flow Step 1: Chặn guest */
  if (!isLoggedIn()) {
    _openGuestModal();
    return;
  }

  const numId = Number(id);
  const pData = _getProductData(numId);
  let cart    = _loadCart();

  const existing = cart.find(x => x.id === numId);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      id:        numId,
      name:      pData?.name      || `Sản phẩm #${numId}`,
      price:     pData?.price     || Number(price) || 0,
      image_url: pData?.image_url || '',
      cat:       pData?.category  || pData?.cat || '',
      qty:       1,
    });
  }

  _saveCart(cart);
  renderCartSidebar(cart);
  toggleCart(true);
  showToast('🛒 Đã thêm vào giỏ hàng!', 'ok');
};

/* ── Popup yêu cầu đăng nhập (Guest Mode) ───────────────────── */
function _openGuestModal() {
  /* Nếu trang có modal sẵn */
  const m = document.getElementById('loginRequiredModal') || document.getElementById('guestModal');
  if (m) { m.classList.add('active'); return; }

  /* Tạo modal nhanh nếu không có */
  const overlay = document.createElement('div');
  overlay.id = '_guestOverlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);
    display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px)`;
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:36px 32px;max-width:360px;
                width:90%;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.3)">
      <div style="width:60px;height:60px;border-radius:50%;background:#f5ede4;
                  display:flex;align-items:center;justify-content:center;
                  margin:0 auto 16px;font-size:24px;color:#c9922a">
        <i class="fa-solid fa-lock"></i>
      </div>
      <h3 style="font-size:1.15rem;font-weight:800;color:#2a1a0e;margin-bottom:8px">Yêu cầu đăng nhập</h3>
      <p style="font-size:14px;color:#7a6a5a;margin-bottom:22px;line-height:1.6">
        Bạn cần đăng nhập để thêm sản phẩm vào giỏ hàng và tiến hành mua sắm.
      </p>
      <div style="display:flex;flex-direction:column;gap:10px">
        <a href="/login?next=/order" style="
          display:flex;align-items:center;justify-content:center;gap:8px;
          padding:12px;border-radius:10px;background:#7a5230;color:#f5e4c0;
          text-decoration:none;font-weight:700;font-size:14px">
          <i class="fa-solid fa-right-to-bracket"></i> Đăng nhập ngay
        </a>
        <button onclick="document.getElementById('_guestOverlay').remove()" style="
          padding:11px;border-radius:10px;background:none;
          border:1.5px solid #ead9c4;color:#7a6a5a;
          font-size:13px;font-weight:700;cursor:pointer">
          Để sau
        </button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

/* ================================================================
   2. SIDEBAR GIỎ HÀNG
   ================================================================ */
function toggleCart(forceOpen = null) {
  const sidebar = document.getElementById('cartSidebar');
  const overlay = document.getElementById('cartOverlay');
    
  sidebar.classList.toggle('active');
  overlay.classList.toggle('active');
  if (!sidebar) return;

  const isOpen = forceOpen !== null ? forceOpen : !sidebar.classList.contains('active');
  sidebar.classList.toggle('active', isOpen);
  if (overlay) overlay.classList.toggle('active', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';

  if (isOpen) renderCartSidebar(_loadCart());
}

function openCheckout() {
    window.location.href = "/order"; 
}

function renderCartSidebar(cart) {
  const container = document.getElementById('cartItems');
  if (!container) return;

  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) checkoutBtn.disabled = false;
  
  if (!cart.length) {
    container.innerHTML = `
      <div class="empty-cart">
        <i class="fa-solid fa-cart-shopping"></i>
        <p>Giỏ hàng đang trống</p>
      </div>`;
    updateCartSummary(cart);
    return;
  }

  container.innerHTML = cart.map(x => `
    <div class="cart-item">
      ${x.image_url
        ? `<img class="cart-item-image" src="${x.image_url}" alt="${x.name}">`
        : `<div class="cart-item-image" style="display:flex;align-items:center;justify-content:center;background:var(--surface-2)">
             <i class="fa-solid fa-guitar" style="color:var(--text-muted)"></i>
           </div>`}
      <div class="cart-item-info">
        <div class="cart-item-name">${x.name}</div>
        <div class="cart-item-price">${fmt(x.price * x.qty)}</div>
        <div class="quantity-control">
          <button class="qty-btn" onclick="cartChangeQty(${x.id}, -1)">−</button>
          <span class="qty-display">${x.qty}</span>
          <button class="qty-btn" onclick="cartChangeQty(${x.id}, +1)">+</button>
        </div>
      </div>
      <button class="remove-item" onclick="cartRemoveItem(${x.id})" title="Xóa">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>`).join('');

  updateCartSummary(cart);
  
}

function openCheckout() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.length === 0) {
        alert("Không có nhạc cụ nào để thanh toán!");
        return;
    }
    window.location.href = "/order"; // Chuyển sang trang thanh toán
}

function updateCartSummary(cart) {
  let couponApplied = null; /* Simplified – coupon managed in /cart page */
  const sub = cart.reduce((s, x) => s + (x.price || 0) * x.qty, 0);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('summarySubtotal', fmt(sub));
  set('summaryDiscount', '−0₫');
  set('summaryTotal',    fmt(sub));
}

window.cartChangeQty = function (id, delta) {
  let cart = _loadCart();
  const item = cart.find(x => x.id === Number(id));
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(x => x.id !== Number(id));
  _saveCart(cart);
  renderCartSidebar(cart);
};

window.cartRemoveItem = function (id) {
  let cart = _loadCart().filter(x => x.id !== Number(id));
  _saveCart(cart);
  renderCartSidebar(cart);
  showToast('Đã xóa sản phẩm', 'ok');
};

/* ── Coupon ──────────────────────────────────────────────────── */
window.applyCoupon = function () {
  const input = document.getElementById('couponInput');
  const msgEl = document.getElementById('couponMsg');
  const code  = (input?.value || '').trim().toUpperCase();
  if (!code) return;
  if (COUPONS[code]) {
    if (msgEl) { msgEl.textContent = `✓ ${COUPONS[code].label}`; msgEl.className = 'coupon-msg ok'; }
    showToast(`Áp dụng "${code}" thành công!`, 'ok');
  } else {
    if (msgEl) { msgEl.textContent = 'Mã không hợp lệ'; msgEl.className = 'coupon-msg err'; }
  }
};

/* ── Checkout → redirect /cart ───────────────────────────────── */
window.openCheckout = function () {
  if (!_loadCart().length) { showToast('Giỏ hàng đang trống!', 'err'); return; }
  if (!isLoggedIn()) { _openGuestModal(); return; }
  window.location.href = '/cart';
};

/* ================================================================
   3. MODAL CHI TIẾT SẢN PHẨM
   ================================================================ */
window.openProductModal = function (id) {
  const pData = _getProductData(id);
  const modal = document.getElementById('productModal');
  const body  = document.getElementById('modalBody');
  if (!modal || !body) return;

  if (pData) {
    body.innerHTML = `
      <div class="modal-grid">
        <div class="modal-img-wrap">
          ${pData.image_url
            ? `<img class="modal-img" src="${pData.image_url}" alt="${pData.name}">`
            : `<div class="modal-img" style="display:flex;align-items:center;justify-content:center;background:var(--surface-2)">
                 <i class="fa-solid fa-guitar" style="font-size:4rem;color:var(--text-muted)"></i>
               </div>`}
        </div>
        <div class="modal-info">
          <p class="product-category">${pData.category || pData.cat || ''}</p>
          <h3>${pData.name}</h3>
          <div class="modal-price-block">
            <p class="current-price">${fmt(pData.price)}</p>
            ${pData.orig && pData.orig > pData.price
              ? `<p style="font-size:13px;text-decoration:line-through;color:var(--text-muted)">${fmt(pData.orig)}</p>` : ''}
          </div>
          ${pData.description ? `<p class="modal-desc">${pData.description}</p>` : ''}
          <button class="modal-add-btn" onclick="addToCart(${pData.id}, ${pData.price}); closeModal()">
            <i class="fa-solid fa-cart-plus"></i> Thêm vào giỏ hàng
          </button>
        </div>
      </div>
      ${pData.specs && Object.keys(pData.specs).length ? `
        <div class="modal-specs">
          <h4><i class="fa-solid fa-list-check"></i> Thông số kỹ thuật</h4>
          <div class="specs-grid">
            ${Object.entries(pData.specs).map(([k, v]) => `
              <div class="spec-row">
                <span class="spec-label">${k}</span>
                <span class="spec-value">${v}</span>
              </div>`).join('')}
          </div>
        </div>` : ''}`;
  }
  modal.classList.add('active');
};

window.closeModal = function () { document.getElementById('productModal')?.classList.remove('active'); };
window.handleModalOverlayClick = function (e) { if (e.target.id === 'productModal') window.closeModal(); };

/* ================================================================
   4. LỌC – TÌM KIẾM – SẮP XẾP  (một hàm duy nhất, không duplicate)
   ================================================================ */
let allCards = [];

function filterAndSort() {
  const selCat  = (document.getElementById('categoryFilter')?.value || 'all').toLowerCase();
  const sortVal = document.getElementById('priceSort')?.value || 'default';
  const keyword = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const section = document.getElementById('productsSection');
  const cntEl   = document.getElementById('resultsCount');

  /* 1. Lọc theo danh mục & từ khóa */
  let visible = allCards.filter(card => {
    const cat  = (card.getAttribute('data-category') || '').toLowerCase();
    const name = (card.querySelector('.product-name')?.textContent || '').toLowerCase();
    return (selCat === 'all' || cat === selCat) && (!keyword || name.includes(keyword));
  });

  /* 2. Lọc theo badge (sale/hot/new/limited) */
  if (['sale', 'hot', 'new', 'limited'].includes(sortVal)) {
    visible = visible.filter(card => card.querySelector(`.badge-${sortVal}`) !== null);
  }

  /* 3. Sắp xếp giá */
  if (sortVal === 'low')  visible.sort((a, b) => _getCardPrice(a) - _getCardPrice(b));
  if (sortVal === 'high') visible.sort((a, b) => _getCardPrice(b) - _getCardPrice(a));

  /* 4. Render */
  allCards.forEach(c => { c.style.display = 'none'; c.classList.remove('fade-in-up'); });
  visible.forEach((card, i) => {
    card.style.display = 'flex';
    section?.appendChild(card);
    setTimeout(() => card.classList.add('fade-in-up'), i * 30);
  });

  /* 5. Count */
  if (cntEl) cntEl.innerHTML = `Tìm thấy <strong>${visible.length}</strong> sản phẩm`;

  /* 6. No-result state */
  let noResult = section?.querySelector('.no-products-msg');
  if (!visible.length) {
    if (!noResult) {
      noResult = document.createElement('div');
      noResult.className = 'no-products-msg';
      noResult.style.cssText = 'grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)';
      noResult.innerHTML = `<i class="fa-solid fa-magnifying-glass" style="font-size:2.5rem;opacity:.3;display:block;margin-bottom:12px"></i><p>Không tìm thấy sản phẩm phù hợp</p>`;
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
  /* Snapshot tất cả card */
  allCards = Array.from(document.querySelectorAll('.product-card'));

  /* Cart badges */
  const cart = _loadCart();
  _saveCart(cart); /* cập nhật badge */

  /* Filter events */
  document.getElementById('searchInput')?.addEventListener('input', filterAndSort);
  document.getElementById('priceSort')?.addEventListener('change', filterAndSort);
  document.getElementById('categoryFilter')?.addEventListener('change', () => {
    const val = document.getElementById('categoryFilter').value;
    document.querySelectorAll('.cat-tab').forEach(t =>
      t.classList.toggle('active', t.getAttribute('data-cat') === val));
    filterAndSort();
  });

  /* Category tab click */
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.getAttribute('data-cat');
      const sel = document.getElementById('categoryFilter');
      if (sel) sel.value = cat;
      filterAndSort();
      document.getElementById('productsSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* URL param ?cat=Guitar */
  const urlCat = new URLSearchParams(window.location.search).get('cat');
  if (urlCat) {
    const sel = document.getElementById('categoryFilter');
    if (sel) sel.value = urlCat;
    document.querySelectorAll('.cat-tab').forEach(t =>
      t.classList.toggle('active', t.getAttribute('data-cat') === urlCat));
  }

  /* URL param ?search= */
  const urlSearch = new URLSearchParams(window.location.search).get('search');
  if (urlSearch) {
    const inp = document.getElementById('searchInput');
    if (inp) inp.value = urlSearch;
  }

  filterAndSort();

  /* Pay option click trong checkout modal */
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
});

/* ── Expose toggleCart ───────────────────────────────────────── */
window.toggleCart = toggleCart;