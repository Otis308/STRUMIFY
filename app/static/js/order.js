/* ================================================================
   STRUMIFY – order.js  (BẢN SỬA LỖI HOÀN CHỈNH)
   Fixes:
     1. Bỏ `import` ES‑module → file không còn bị lỗi parse
     2. addToCart() đúng tên (HTML gọi addToCart, không phải addProductToCart)
     3. Cart sidebar dùng .active thay vì .open (khớp với CSS)
     4. Modal overlay dùng .active (khớp với CSS)
     5. Lọc, tìm kiếm, sắp xếp hoạt động đầy đủ
     6. Scroll đến lưới sản phẩm khi bấm tab
     7. Tất cả hàm HTML cần: toggleCart, openProductModal, handleModalOverlayClick…
   ================================================================ */
'use strict';

/* ── CẤU HÌNH ───────────────────────────────────────────────── */
const CART_KEY = 'strumify_cart';

const COUPONS = {
  'MOC10':    { type: 'percent', value: 10,      label: 'Giảm 10%' },
  'MOC20':    { type: 'percent', value: 20,      label: 'Giảm 20%' },
  'NEWUSER':  { type: 'percent', value: 15,      label: 'Khách mới −15%' },
  'GUITAR50': { type: 'fixed',   value: 500_000, label: 'Giảm 500.000₫' },
  'VIP25':    { type: 'percent', value: 25,      label: 'VIP −25%' },
};

const BANK = {
  bankBin:     '970422',
  accountNo:   '89779799999',
  accountName: 'CONG TY STRUMIFY INSTRUMENT',
  bankFull:    'MB Bank',
};

/* ── TRẠNG THÁI GIỎ HÀNG ────────────────────────────────────── */
let cart         = _loadStorage();
let couponApplied = null;
let _toastTimer  = null;

/* ── UTILS ──────────────────────────────────────────────────── */
function fmt(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
}
function _loadStorage() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
  catch { return []; }
}
function _saveStorage() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}
function _getProductData(id) {
  if (typeof PRODUCT_DATA === 'undefined') return null;
  return PRODUCT_DATA.find(p => p.id === Number(id)) || null;
}

/* ── BADGE ──────────────────────────────────────────────────── */
function updateCartBadges() {
  const total = cart.reduce((s, x) => s + x.qty, 0);
  document.querySelectorAll('.cart-badge, .cart-count').forEach(el => {
    el.textContent = total;
    el.style.display = total > 0 ? 'inline-flex' : 'none';
  });
}

/* ================================================================
   1. THÊM / XÓA / SỬA SỐ LƯỢNG
   ================================================================ */

/**
 * Hàm này được gọi từ nút (+) trên từng product‑card trong HTML:
 *   onclick="addToCart({{ g.id }}, {{ g.price }})"
 */
window.addToCart = function (id, price) {
  const numId = Number(id);
  const pData = _getProductData(numId);

  const existing = cart.find(x => x.id === numId);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      id:        numId,
      name:      pData?.name      || `Sản phẩm #${numId}`,
      price:     pData?.price     || Number(price) || 0,
      image_url: pData?.image_url || '',
      qty:       1,
    });
  }

  _saveStorage();
  updateCartBadges();
  renderCartItems();
  showToast('🛒 Đã thêm vào giỏ hàng!', 'ok');
};

window.changeQty = function (id, delta) {
  const item = cart.find(x => x.id === Number(id));
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(x => x.id !== Number(id));
  _saveStorage();
  updateCartBadges();
  renderCartItems();
};

window.removeFromCart = function (id) {
  cart = cart.filter(x => x.id !== Number(id));
  _saveStorage();
  updateCartBadges();
  renderCartItems();
  showToast('Đã xóa sản phẩm', 'ok');
};

/* ================================================================
   2. SIDEBAR GIỎ HÀNG
   ================================================================ */

/** toggleCart() được gọi từ mọi nút giỏ hàng trong HTML */
window.toggleCart = function () {
  const sidebar = document.getElementById('cartSidebar');
  const overlay = document.getElementById('cartOverlay');
  if (!sidebar) return;

  const isOpen = sidebar.classList.toggle('active');   // CSS dùng .active
  if (overlay) overlay.classList.toggle('active', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';

  if (isOpen) renderCartItems();
};

function renderCartItems() {
  const container = document.getElementById('cartItems');
  if (!container) return;

  // Cập nhật nút Thanh toán
  const btn = document.getElementById('checkoutBtn');
  if (btn) btn.disabled = cart.length === 0;

  if (!cart.length) {
    container.innerHTML = `
      <div class="empty-cart">
        <i class="fa-solid fa-cart-shopping"></i>
        <p>Giỏ hàng đang trống</p>
      </div>`;
    updateSummaryDisplays();
    return;
  }

  container.innerHTML = cart.map(x => {
    const imgHtml = x.image_url
      ? `<img class="cart-item-image" src="${x.image_url}" alt="${x.name}">`
      : `<div class="cart-item-image" style="display:flex;align-items:center;justify-content:center;background:var(--surface-2)"><i class="fa-solid fa-guitar" style="color:var(--text-muted)"></i></div>`;

    return `
      <div class="cart-item">
        ${imgHtml}
        <div class="cart-item-info">
          <div class="cart-item-name">${x.name}</div>
          <div class="cart-item-price">${fmt(x.price * x.qty)}</div>
          <div class="quantity-control">
            <button class="qty-btn" onclick="changeQty(${x.id}, -1)">−</button>
            <span class="qty-display">${x.qty}</span>
            <button class="qty-btn" onclick="changeQty(${x.id}, +1)">+</button>
          </div>
        </div>
        <button class="remove-item" onclick="removeFromCart(${x.id})" title="Xóa">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>`;
  }).join('');

  updateSummaryDisplays();
}

/* ── COUPON ─────────────────────────────────────────────────── */
window.applyCoupon = function () {
  const input  = document.getElementById('couponInput');
  const msgEl  = document.getElementById('couponMsg');
  const code   = (input?.value || '').trim().toUpperCase();
  if (!code) return;

  if (COUPONS[code]) {
    couponApplied = { code, ...COUPONS[code] };
    if (msgEl) { msgEl.textContent = `✓ ${couponApplied.label}`; msgEl.className = 'coupon-msg ok'; }
    showToast(`Áp dụng "${code}" thành công!`, 'ok');
  } else {
    couponApplied = null;
    if (msgEl) { msgEl.textContent = 'Mã không hợp lệ'; msgEl.className = 'coupon-msg err'; }
    showToast('Mã giảm giá không hợp lệ', 'err');
  }
  updateSummaryDisplays();
};

/* ── TÍNH TOÁN GIÁ ──────────────────────────────────────────── */
function calcSubtotal() { return cart.reduce((s, x) => s + x.price * x.qty, 0); }
function calcDiscount(sub) {
  if (!couponApplied) return 0;
  return couponApplied.type === 'percent'
    ? Math.round(sub * couponApplied.value / 100)
    : Math.min(couponApplied.value, sub);
}
function calcTotal() {
  const sub = calcSubtotal();
  return Math.max(0, sub - calcDiscount(sub));
}

function updateSummaryDisplays() {
  const sub  = calcSubtotal();
  const disc = calcDiscount(sub);
  const tot  = calcTotal();

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('summarySubtotal', fmt(sub));
  set('summaryDiscount', `−${fmt(disc)}`);
  set('summaryTotal',    fmt(tot));
  // Bảng tổng trong checkout modal
  set('coSubtotal', fmt(sub));
  set('coDiscount', `−${fmt(disc)}`);
  set('coTotal',    fmt(tot));
}

/* ================================================================
   3. CHECKOUT MODAL (đơn giản)
   ================================================================ */
window.openCheckout = function () {
  if (!cart.length) { showToast('Giỏ hàng đang trống!', 'err'); return; }

  const el = document.getElementById('checkoutModal');
  if (!el) return;
  el.classList.add('active');          // CSS: .checkout-modal-overlay.active { display:flex }

  // Render danh sách sản phẩm đặt mua
  const list = document.getElementById('coItemList');
  if (list) {
    list.innerHTML = cart.map(x => `
      <div class="co-item">
        <span class="co-item-name">${x.name}</span>
        <span class="co-item-qty">×${x.qty}</span>
        <span class="co-item-price">${fmt(x.price * x.qty)}</span>
      </div>`).join('');
  }

  // Hiện coupon đã áp dụng
  const copon = document.getElementById('coAppliedCoupon');
  if (copon) copon.textContent = couponApplied
    ? `${couponApplied.code} – ${couponApplied.label}`
    : 'Chưa áp dụng';

  updateSummaryDisplays();

  // Gán event cho radio phương thức thanh toán
  document.querySelectorAll('.pay-option').forEach(opt => {
    opt.onclick = () => {
      document.querySelectorAll('.pay-option').forEach(o => {
        o.classList.remove('selected');
        o.querySelector('input[type=radio]').checked = false;
      });
      opt.classList.add('selected');
      const radio = opt.querySelector('input[type=radio]');
      if (radio) radio.checked = true;
      const method = opt.getAttribute('data-method');
      const coPayM = document.getElementById('coPayMethod');
      if (coPayM) coPayM.value = method;
      const bd = document.getElementById('bankDetails');
      if (bd) bd.style.display = method === 'bank' ? 'block' : 'none';
    };
  });
};

window.closeCheckout = function () {
  document.getElementById('checkoutModal')?.classList.remove('active');
};

window.placeOrder = async function () {
  const name    = document.getElementById('co-name')?.value.trim();
  const phone   = document.getElementById('co-phone')?.value.trim();
  const address = document.getElementById('co-address')?.value.trim();
  const method  = document.getElementById('coPayMethod')?.value;

  if (!name || !phone || !address) {
    showToast('Vui lòng điền đủ Họ tên, SĐT và Địa chỉ!', 'err'); return;
  }
  if (!method) {
    showToast('Vui lòng chọn phương thức thanh toán!', 'err'); return;
  }

  const btn = document.querySelector('.place-order-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý…'; }

  try {
    const token = localStorage.getItem('access_token') || '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const payload = {
      items:            cart.map(x => ({ product_id: x.id, quantity: x.qty })),
      receiver_name:    name,
      receiver_phone:   phone,
      receiver_email:   document.getElementById('co-email')?.value.trim() || '',
      receiver_address: address,
      note:             document.getElementById('co-note')?.value.trim() || '',
      pay_method:       method,
      coupon_code:      couponApplied?.code || null,
    };

    const res  = await fetch('/orders/', { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await res.json();

    if (res.ok || res.status === 201) {
      cart = [];
      _saveStorage();
      updateCartBadges();
      renderCartItems();
      closeCheckout();

      const orderId = data.order_code || `STRUMIFY-${Date.now().toString().slice(-6)}`;
      const oid = document.getElementById('successOrderId');
      if (oid) oid.textContent = `Mã đơn: ${orderId}`;
      document.getElementById('successModal')?.classList.add('active');
    } else {
      throw new Error(data.detail || 'Lỗi khi đặt hàng');
    }
  } catch (err) {
    showToast(err.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Đặt hàng ngay'; }
  }
};

window.closeSuccess = function () {
  document.getElementById('successModal')?.classList.remove('active');
};

/* ================================================================
   4. MODAL CHI TIẾT SẢN PHẨM
   ================================================================ */
window.openProductModal = function (id) {
  const pData = _getProductData(id);
  const modal = document.getElementById('productModal');
  const body  = document.getElementById('modalBody');
  if (!modal || !body) return;

  if (pData) {
    const origHtml = (pData.orig && pData.orig > pData.price)
      ? `<p style="font-size:13px;text-decoration:line-through;color:var(--text-muted);margin:0">${fmt(pData.orig)}</p>` : '';

    const starsHtml = _renderStars(pData.rating || 0);

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
          <p class="product-category">${pData.category || ''}</p>
          <h3>${pData.name}</h3>
          <div class="modal-rating">${starsHtml}
            ${pData.reviews ? `<span class="rating-count">(${pData.reviews} đánh giá)</span>` : ''}
          </div>
          <div class="modal-price-block">
            <p class="current-price">${fmt(pData.price)}</p>
            ${origHtml}
          </div>
          ${pData.description ? `<p class="modal-desc">${pData.description}</p>` : ''}
          <button class="modal-add-btn" onclick="addToCart(${pData.id}, ${pData.price}); closeModal()">
            <i class="fa-solid fa-cart-plus"></i> Thêm vào giỏ hàng
          </button>
        </div>
      </div>
      ${pData.specs && Object.keys(pData.specs).length
        ? `<div class="modal-specs">
             <h4><i class="fa-solid fa-list-check"></i> Thông số kỹ thuật</h4>
             <div class="specs-grid">
               ${Object.entries(pData.specs).map(([k, v]) => `
                 <div class="spec-row">
                   <span class="spec-label">${k}</span>
                   <span class="spec-value">${v}</span>
                 </div>`).join('')}
             </div>
           </div>`
        : ''}`;
  } else {
    body.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px">Không tìm thấy thông tin sản phẩm.</p>';
  }

  modal.classList.add('active');
};

window.closeOrderModal = function () {
  document.getElementById('productModal')?.classList.remove('active');
};

window.handleModalOverlayClick = function (e) {
  if (e.target.id === 'productModal') closeModal();
};

function _renderStars(rating) {
  const full = Math.floor(rating), half = (rating - full) >= 0.5 ? 1 : 0, empty = 5 - full - half;
  let s = '';
  for (let i = 0; i < full;  i++) s += '<i class="fa-solid fa-star"            style="color:#f5a623"></i>';
  if (half)                        s += '<i class="fa-solid fa-star-half-stroke" style="color:#f5a623"></i>';
  for (let i = 0; i < empty; i++) s += '<i class="fa-regular fa-star"           style="color:#f5a623"></i>';
  return `<span class="stars">${s}</span><span class="rating-num" style="font-weight:700">${rating.toFixed(1)}</span>`;
}

/* ================================================================
   5. TOAST NOTIFICATION
   ================================================================ */
window.showToast = function (msg, type = 'info') {
  const el   = document.getElementById('toastNotification');
  const icon = document.getElementById('toastIcon');
  const text = document.getElementById('toastText');
  if (!el) { console.info('[Toast]', msg); return; }

  if (icon) icon.textContent = type === 'ok' ? '✓' : type === 'err' ? '✕' : 'ℹ';
  if (text) text.textContent = msg;
  el.className = `toast-notification show ${type === 'ok' ? 'success' : type === 'err' ? 'error' : ''}`;

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
};

/* ================================================================
   6. LỌC – TÌM KIẾM – SẮP XẾP
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const catTabs       = document.querySelectorAll('.cat-tab');
  const categoryFilter = document.getElementById('categoryFilter');
  const searchInput   = document.getElementById('searchInput');
  const priceSort     = document.getElementById('priceSort');
  const productsSection = document.getElementById('productsSection');
  const resultsCount  = document.getElementById('resultsCount');

  // Snapshot toàn bộ card ngay khi DOM ready
  let allCards = Array.from(document.querySelectorAll('.product-card'));

  /* ── Hàm lọc + sắp xếp chính ─────────────────────────────── */
  function filterAndSort() {
    const selCat    = (categoryFilter?.value || 'all').toLowerCase();
    const search    = (searchInput?.value   || '').toLowerCase().trim();
    const sortVal   = priceSort?.value || 'default';

    // 1. Lọc
    let visible = allCards.filter(card => {
      const cardCat  = (card.getAttribute('data-category') || '').toLowerCase();
      const cardName = (card.querySelector('.product-name')?.textContent || '').toLowerCase();
      const okCat    = selCat === 'all' || cardCat === selCat;
      const okSearch = !search || cardName.includes(search);
      return okCat && okSearch;
    });

    // 2. Sắp xếp
    if (sortVal === 'low')  visible.sort((a, b) => _getCardPrice(a) - _getCardPrice(b));
    if (sortVal === 'high') visible.sort((a, b) => _getCardPrice(b) - _getCardPrice(a));

    // 3. Ẩn tất cả
    allCards.forEach(c => { c.style.display = 'none'; c.classList.remove('fade-in-up'); });

    // 4. Hiện + append theo thứ tự mới (cho sort)
    visible.forEach((card, i) => {
      card.style.display = 'flex';
      productsSection?.appendChild(card);
      setTimeout(() => card.classList.add('fade-in-up'), i * 35);
    });

    // 5. Cập nhật bộ đếm
    if (resultsCount) {
      resultsCount.innerHTML = `Tìm thấy <strong>${visible.length}</strong> sản phẩm`;
    }

    // 6. Hiện/ẩn thông báo không có sản phẩm
    let noResult = productsSection?.querySelector('.no-products-msg');
    if (!visible.length) {
      if (!noResult) {
        noResult = document.createElement('div');
        noResult.className = 'no-products-msg';
        noResult.style.cssText = 'grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)';
        noResult.innerHTML = '<i class="fa-solid fa-magnifying-glass" style="font-size:2.5rem;opacity:.3;display:block;margin-bottom:12px"></i><p>Không tìm thấy sản phẩm phù hợp</p>';
        productsSection?.appendChild(noResult);
      }
    } else {
      noResult?.remove();
    }
  }

  function _getCardPrice(card) {
    const t = card.querySelector('.product-price')?.textContent || '0';
    return parseInt(t.replace(/[^\d]/g, ''), 10) || 0;
  }

  /* ── Hàm lọc + sắp xếp chính ─────────────────────────────── */
  function filterAndSort() {
    const selCat    = (categoryFilter?.value || 'all').toLowerCase();
    const search    = (searchInput?.value   || '').toLowerCase().trim();
    const sortVal   = priceSort?.value || 'default';

    // 1. Lọc sản phẩm theo danh mục và tìm kiếm
    let visible = allCards.filter(card => {
      const cardCat  = (card.getAttribute('data-category') || '').toLowerCase();
      const cardName = (card.querySelector('.product-name')?.textContent || '').toLowerCase();
      const okCat    = selCat === 'all' || cardCat === selCat;
      const okSearch = !search || cardName.includes(search);
      return okCat && okSearch;
    });

    // 2. Sắp xếp nâng cao
    if (sortVal === 'low')  visible.sort((a, b) => _getCardPrice(a) - _getCardPrice(b));
    if (sortVal === 'high') visible.sort((a, b) => _getCardPrice(b) - _getCardPrice(a));
    
    // Logic đẩy các sản phẩm có Badge tương ứng lên đầu
    if (sortVal === 'sale')    visible.sort((a, b) => _hasBadge(b, 'SALE') - _hasBadge(a, 'SALE'));
    if (sortVal === 'hot')     visible.sort((a, b) => _hasBadge(b, 'HOT') - _hasBadge(a, 'HOT'));
    if (sortVal === 'new')     visible.sort((a, b) => _hasBadge(b, 'NEW') - _hasBadge(a, 'NEW'));
    if (sortVal === 'limited') visible.sort((a, b) => _hasBadge(b, 'LIMITED') - _hasBadge(a, 'LIMITED'));

    // 3. Ẩn tất cả và reset animation
    allCards.forEach(c => { 
      c.style.display = 'none'; 
      c.classList.remove('fade-in-up'); 
    });

    // 4. Hiển thị và áp dụng hiệu ứng nảy (pop) theo thứ tự
    visible.forEach((card, i) => {
      card.style.display = 'flex';
      productsSection?.appendChild(card);
      // Tạo hiệu ứng xuất hiện tuần tự mượt mà
      setTimeout(() => card.classList.add('fade-in-up'), i * 35);
    });

    // 5. Cập nhật bộ đếm sản phẩm
    if (resultsCount) {
      resultsCount.innerHTML = `Tìm thấy <strong>${visible.length}</strong> sản phẩm`;
    }

    // 6. Xử lý thông báo khi không tìm thấy kết quả
    _handleNoResults(visible.length);
  }

  /* ── Các hàm bổ trợ (Helpers) ─────────────────────────────── */
  
  // Hàm kiểm tra thẻ có chứa Badge cụ thể không (không phân biệt hoa thường)
  function _hasBadge(card, badgeText) {
    const badge = card.querySelector('.product-badge');
    if (!badge) return false;
    return badge.textContent.trim().toUpperCase() === badgeText.toUpperCase();
  }

  function _getCardPrice(card) {
    const t = card.querySelector('.product-price')?.textContent || '0';
    return parseInt(t.replace(/[^\d]/g, ''), 10) || 0;
  }

  function _handleNoResults(count) {
    let noResult = productsSection?.querySelector('.no-products-msg');
    if (count === 0) {
      if (!noResult) {
        noResult = document.createElement('div');
        noResult.className = 'no-products-msg';
        noResult.style.cssText = 'grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)';
        noResult.innerHTML = '<i class="fa-solid fa-magnifying-glass" style="font-size:2.5rem;opacity:.3;display:block;margin-bottom:12px"></i><p>Không tìm thấy sản phẩm phù hợp</p>';
        productsSection?.appendChild(noResult);
      }
    } else {
      noResult?.remove();
    }
  }

  /* ================================================================
   STRUMIFY – Logic Lọc & Sắp xếp Thông minh
   Ưu tiên: LIMITED -> NEW -> HOT -> SALE (khi chọn Tất cả)
   ================================================================ */

function filterAndSort() {
  const categoryFilter = document.getElementById('categoryFilter');
  const priceSort = document.getElementById('priceSort');
  const searchInput = document.getElementById('searchInput');
  const productsSection = document.getElementById('productsSection');
  
  // 1. Lấy dữ liệu người dùng chọn
  const selCat = (categoryFilter?.value || 'all').toLowerCase();
  const sortVal = priceSort?.value || 'default';
  const keyword = (searchInput?.value || '').toLowerCase().trim();

  // Lấy snapshot tất cả card (đã được lưu từ đầu trong allCards)
  let visible = allCards.filter(card => {
    const cardCat = (card.getAttribute('data-category') || '').toLowerCase();
    const cardName = (card.querySelector('.product-name')?.textContent || '').toLowerCase();
    
    const matchCat = (selCat === 'all' || cardCat === selCat);
    const matchSearch = cardName.includes(keyword);
    return matchCat && matchSearch;
  });

  // 2. LOGIC SẮP XẾP CHÍNH
  if (sortVal === 'default') {
    // TRƯỜNG HỢP: Lọc "Tất cả" -> Sắp xếp theo độ hiếm/mới
    if (selCat === 'all') {
      visible.sort((a, b) => _getPriority(b) - _getPriority(a));
    }
    // TRƯỜNG HỢP: Lọc theo loại (Violin, Guitar...) -> Giữ nguyên thứ tự mặc định
  } else {
    // TRƯỜNG HỢP: Người dùng chủ động chọn Field sắp xếp
    if (sortVal === 'low') visible.sort((a, b) => _getPrice(a) - _getPrice(b));
    else if (sortVal === 'high') visible.sort((a, b) => _getPrice(b) - _getPrice(a));
    else if (sortVal === 'sale') visible.sort((a, b) => _checkBadge(b, 'badge-sale') - _checkBadge(a, 'badge-sale'));
    else if (sortVal === 'hot') visible.sort((a, b) => _checkBadge(b, 'badge-hot') - _checkBadge(a, 'badge-hot'));
    else if (sortVal === 'new') visible.sort((a, b) => _checkBadge(b, 'badge-new') - _checkBadge(a, 'badge-new'));
    else if (sortVal === 'limited') visible.sort((a, b) => _checkBadge(b, 'badge-limited') - _checkBadge(a, 'badge-limited'));
  }

  // 3. RENDER LẠI MÀN HÌNH
  _updateDisplay(visible);
}

/* ── HÀM BỔ TRỢ (HELPERS) ── */

// Xác định mức độ ưu tiên: LIMIT (4) -> NEW (3) -> HOT (2) -> SALE (1)
function _getPriority(card) {
  const badge = card.querySelector('.product-badge');
  if (!badge) return 0;
  if (badge.classList.contains('badge-limited')) return 4;
  if (badge.classList.contains('badge-new'))     return 3;
  if (badge.classList.contains('badge-hot'))     return 2;
  if (badge.classList.contains('badge-sale'))    return 1;
  return 0;
}

function _checkBadge(card, className) {
  return card.querySelector('.product-badge')?.classList.contains(className) ? 1 : 0;
}

function _getPrice(card) {
  const priceText = card.querySelector('.product-price')?.textContent || '0';
  return parseInt(priceText.replace(/[^\d]/g, ''), 10);
}

function _updateDisplay(visibleCards) {
  const productsSection = document.getElementById('productsSection');
  const resultsCount = document.getElementById('resultsCount');

  // Ẩn toàn bộ trước khi hiện
  allCards.forEach(c => { c.style.display = 'none'; c.classList.remove('fade-in-up'); });

  visibleCards.forEach((card, i) => {
    card.style.display = 'flex';
    productsSection.appendChild(card); // Đưa lại vào DOM theo thứ tự đã sort
    // Hiệu ứng nảy lên nhẹ nhàng
    setTimeout(() => card.classList.add('fade-in-up'), i * 30);
  });

  if (resultsCount) resultsCount.innerHTML = `Tìm thấy <strong>${visibleCards.length}</strong> sản phẩm`;
}

/* ================================================================
   STRUMIFY – Unified Strict Filter Logic
   Cơ chế: Chọn gì hiện nấy - Loại bỏ hoàn toàn các sản phẩm không khớp.
   ================================================================ */

function filterAndSort() {
  const categoryFilter = document.getElementById('categoryFilter');
  const priceSort = document.getElementById('priceSort');
  const searchInput = document.getElementById('searchInput');
  
  // 1. Lấy giá trị đầu vào từ giao diện
  const selCat = (categoryFilter?.value || 'all').toLowerCase();
  const sortVal = (priceSort?.value || 'default').toLowerCase();
  const keyword = (searchInput?.value || '').toLowerCase().trim();

  // 2. Bước 1: Lọc theo Danh mục & Từ khóa (Search)
  let filtered = allCards.filter(card => {
    const cardCat = (card.getAttribute('data-category') || '').toLowerCase();
    const cardName = (card.querySelector('.product-name')?.textContent || '').toLowerCase();
    
    const matchCat = (selCat === 'all' || cardCat === selCat);
    const matchSearch = cardName.includes(keyword);
    return matchCat && matchSearch;
  });

  // 3. Bước 2: Lọc NGHIÊM NGẶT theo nhãn (Badge)
  // Nếu người dùng chọn Sale, Hot, New, hoặc Limited -> Xóa sạch những cái không có badge đó.
  if (['sale', 'hot', 'new', 'limited'].includes(sortVal)) {
    filtered = filtered.filter(card => {
      // Tìm đúng class badge tương ứng: badge-sale, badge-hot, badge-new, badge-limited
      return card.querySelector(`.badge-${sortVal}`) !== null;
    });
  }

  // 4. Bước 3: Sắp xếp theo giá (Chỉ chạy nếu chọn High/Low)
  if (sortVal === 'low') {
    filtered.sort((a, b) => _getPrice(a) - _getPrice(b));
  } else if (sortVal === 'high') {
    filtered.sort((a, b) => _getPrice(b) - _getPrice(a));
  }

  // 5. Cập nhật giao diện người dùng
  _renderFilteredResults(filtered);
}

/* ── HÀM HỖ TRỢ KỸ THUẬT ── */

function _getPrice(card) {
  const priceText = card.querySelector('.product-price')?.textContent || '0';
  return parseInt(priceText.replace(/[^\d]/g, ''), 10);
}

function _renderFilteredResults(cardsToShow) {
  const productsSection = document.getElementById('productsSection');
  const resultsCount = document.getElementById('resultsCount');

  // Ẩn tất cả card hiện có để tránh bị chồng chéo
  allCards.forEach(c => { 
    c.style.display = 'none'; 
    c.classList.remove('fade-in-up'); 
  });

  // Hiển thị danh sách card đã vượt qua các vòng lọc
  cardsToShow.forEach((card, i) => {
    card.style.display = 'flex';
    productsSection.appendChild(card); 
    // Hiệu ứng fade-in mượt mà
    setTimeout(() => card.classList.add('fade-in-up'), i * 20);
  });

  // Cập nhật bộ đếm sản phẩm
  if (resultsCount) {
    resultsCount.innerHTML = cardsToShow.length > 0 
      ? `Tìm thấy <strong>${cardsToShow.length}</strong> sản phẩm` 
      : `Không tìm thấy sản phẩm nào phù hợp`;
  }
}

  /* ── Tab danh mục ─────────────────────────────────────────── */
  catTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const cat = tab.getAttribute('data-cat');

      // Cập nhật active
      catTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Đồng bộ select box
      if (categoryFilter) categoryFilter.value = cat;

      filterAndSort();

      // ← FIX: Cuộn xuống lưới sản phẩm khi bấm tab
      if (productsSection) {
        productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ── Select box lọc ──────────────────────────────────────── */
  categoryFilter?.addEventListener('change', () => {
    const val = categoryFilter.value;
    catTabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-cat') === val));
    filterAndSort();
  });

  /* ── Ô tìm kiếm ──────────────────────────────────────────── */
  searchInput?.addEventListener('input', filterAndSort);

  /* ── Sắp xếp giá ─────────────────────────────────────────── */
  priceSort?.addEventListener('change', filterAndSort);

  /* ── Khởi tạo ────────────────────────────────────────────── */
  filterAndSort();
  updateCartBadges();
  renderCartItems();
});