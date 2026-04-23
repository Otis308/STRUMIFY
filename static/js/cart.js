/* ================================================================
   STRUMIFY – cart.js  (Server-side Cart)
   Giỏ hàng lưu trên DB qua API, không dùng localStorage.
   Mỗi account có giỏ hàng riêng hoàn toàn.

   API sử dụng:
     GET    /cart/          → load giỏ hàng
     POST   /cart/add       → thêm / cộng dồn
     PUT    /cart/{id}      → cập nhật số lượng
     DELETE /cart/{id}      → xóa 1 item
     DELETE /cart/clear     → xóa tất cả
     POST   /orders/checkout → đặt hàng
   ================================================================ */
'use strict';

const API_BASE = '';

/* ── AUTH ────────────────────────────────────────────────────── */
function getToken() { return localStorage.getItem('access_token') || ''; }
function isLoggedIn() {
  const t = getToken();
  if (!t) return false;
  try { const p = JSON.parse(atob(t.split('.')[1])); return p.exp * 1000 > Date.now(); }
  catch { return false; }
}
function authH() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

/* ── COUPON (client-only preview, server validates) ──────────── */
const COUPONS = {
  'MOC10':    { type: 'percent', value: 10,        label: 'Giảm 10%' },
  'MOC20':    { type: 'percent', value: 20,        label: 'Giảm 20%' },
  'MOC30':    { type: 'percent', value: 30,        label: 'Giảm 30%' },
  'NEWUSER':  { type: 'percent', value: 15,        label: 'Khách mới -15%' },
  'GUITAR50': { type: 'fixed',   value: 500_000,   label: 'Giảm 500.000VND' },
  'SALE100':  { type: 'fixed',   value: 1_000_000, label: 'Giảm 1.000.000VND' },
  'VIP25':    { type: 'percent', value: 25,        label: 'VIP −25%' },
};

const BANK = {
  bankBin: '970422', accountNo: '89779799999',
  accountName: 'CONG TY STRUMIFY INSTRUMENT', bankFullName: 'MB Bank',
};

const VN_PROVINCES = [
  'An Giang','Bà Rịa - Vũng Tàu','Bạc Liêu','Bắc Giang','Bắc Kạn','Bắc Ninh',
  'Bến Tre','Bình Dương','Bình Định','Bình Phước','Bình Thuận','Cà Mau','Cao Bằng',
  'Cần Thơ','Đà Nẵng','Đắk Lắk','Đắk Nông','Điện Biên','Đồng Nai','Đồng Tháp',
  'Gia Lai','Hà Giang','Hà Nam','Hà Nội','Hà Tĩnh','Hải Dương','Hải Phòng',
  'Hậu Giang','Hòa Bình','Hưng Yên','Khánh Hòa','Kiên Giang','Kon Tum','Lai Châu',
  'Lạng Sơn','Lào Cai','Lâm Đồng','Long An','Nam Định','Nghệ An','Ninh Bình',
  'Ninh Thuận','Phú Thọ','Phú Yên','Quảng Bình','Quảng Nam','Quảng Ngãi',
  'Quảng Ninh','Quảng Trị','Sóc Trăng','Sơn La','Tây Ninh','Thái Bình',
  'Thái Nguyên','Thanh Hóa','Thừa Thiên Huế','Tiền Giang','TP. Hồ Chí Minh',
  'Trà Vinh','Tuyên Quang','Vĩnh Long','Vĩnh Phúc','Yên Bái',
];

/* ── STATE ───────────────────────────────────────────────────── */
let serverCart    = [];   // Items từ API
let couponApplied = null;
let deliveryInfo  = null;
let payMethod     = null;
let currentStep   = 1;
let currentOrderId= null;
let _toastTimer   = null;

/* ── FETCH GIỎ HÀNG TỪ API ──────────────────────────────────── */
async function fetchCart() {
  if (!isLoggedIn()) { serverCart = []; updateBadge(); return; }

  try {
    const res  = await fetch(`${API_BASE}/cart/`, { headers: authH() });
    if (!res.ok) throw new Error();
    const data = await res.json();
    serverCart = data.items || [];
    updateBadge();
  } catch {
    serverCart = [];
  }
}

function updateBadge() {
  const total = serverCart.reduce((s, x) => s + x.quantity, 0);
  document.querySelectorAll('.cart-badge, .cart-count').forEach(el => {
    el.textContent = total;
    el.style.display = total > 0 ? '' : 'none';
  });
  const btn = document.getElementById('btnToStep2');
  if (btn) btn.disabled = !serverCart.length;
}

/* ── FORMAT ──────────────────────────────────────────────────── */
function fmt(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
}
function setHTML(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

function showToast(msg, type = 'info') {
  const toast = document.getElementById('pageToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `page-toast show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ── TÍNH GIÁ ────────────────────────────────────────────────── */
function calcSubtotal()  { return serverCart.reduce((s, x) => s + x.line_total, 0); }
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

/* ================================================================
   ĐIỀU HƯỚNG BƯỚC
   ================================================================ */
function goStep(n) {
  if (n >= 2 && !isLoggedIn()) { openModal('loginModal'); return; }
  if (n === 2 && !serverCart.length) { showToast('Giỏ hàng đang trống!', 'err'); return; }
  currentStep = n;
  renderStep(n);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderStep(n) {
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`section${i}`)?.classList.toggle('active', i === n);
    document.getElementById(`section${i}`)?.classList.toggle('hidden', i !== n);
    const si = document.getElementById(`stepItem${i}`);
    if (si) { si.classList.remove('active','done'); if (i<n) si.classList.add('done'); if (i===n) si.classList.add('active'); }
  }
  for (let i = 1; i <= 3; i++) document.getElementById(`conn${i}`)?.classList.toggle('done', i < n);

  if (n === 1) renderCartItems();
  if (n === 2) { renderCartItems(); renderReviewList('reviewList'); updateSummaryDisplays(); }
  if (n === 3) { renderReviewList('payReviewList'); renderDeliveryReview(); updatePaymentSummary(); }
}

/* ================================================================
   STEP 1 – GIỎ HÀNG (dữ liệu từ serverCart)
   ================================================================ */
function renderCartItems() {
  const list   = document.getElementById('cartItemsList');
  const empty  = document.getElementById('emptyCart');
  const clear  = document.getElementById('btnClearAll');
  const cntEl  = document.getElementById('itemsCount');
  if (!list) return;

  const totalQty = serverCart.reduce((s, x) => s + x.quantity, 0);
  if (cntEl) cntEl.textContent = `${totalQty} sản phẩm`;

  if (!serverCart.length) {
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    clear?.classList.add('hidden');
    updateSummaryDisplays();
    return;
  }
  empty?.classList.add('hidden');
  clear?.classList.remove('hidden');

  list.innerHTML = serverCart.map(x => `
    <div class="cart-item-card" id="cartCard${x.id}">
      ${x.image_url
        ? `<img class="item-thumb" src="${x.image_url}" alt="${x.product_name}" loading="lazy">`
        : `<div class="item-thumb-placeholder"><i class="fa-solid ${x.product_type==='course'?'fa-graduation-cap':'fa-guitar'}"></i></div>`}
      <div class="item-info">
        ${x.product_type === 'course' ? '<span class="item-cat" style="background:#e8f4fd;color:#1a6fa8">Khóa học</span>' : `<span class="item-cat">${x.cat || 'Sản phẩm'}</span>`}
        <div class="item-name" title="${x.product_name}">${x.product_name}</div>
        <div class="item-unit-price">${fmt(x.price)}/cái</div>
      </div>
      <div class="item-controls">
        <div class="qty-block">
          <button class="qty-btn" onclick="changeQty(${x.id}, ${x.quantity - 1})">−</button>
          <span class="qty-val">${x.quantity}</span>
          <button class="qty-btn" onclick="changeQty(${x.id}, ${x.quantity + 1})">+</button>
        </div>
        <div class="item-line-price">${fmt(x.line_total)}</div>
        <button class="item-delete" onclick="askDelete(${x.id})">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>`).join('');

  updateSummaryDisplays();
}

/* ── CẬP NHẬT SỐ LƯỢNG → Gọi PUT /cart/{id} ────────────────── */
async function changeQty(cartItemId, newQty) {
  if (newQty <= 0) { askDelete(cartItemId); return; }

  try {
    const res = await fetch(`${API_BASE}/cart/${cartItemId}`, {
      method: 'PUT', headers: authH(),
      body:   JSON.stringify({ quantity: newQty }),
    });
    if (!res.ok) throw new Error();
    /* Cập nhật local state */
    const item = serverCart.find(x => x.id === cartItemId);
    if (item) {
      item.quantity   = newQty;
      item.line_total = item.price * newQty;
    }
    updateBadge();
    renderCartItems();
  } catch {
    showToast('Không thể cập nhật số lượng', 'err');
  }
}

/* ── XÓA ITEM → Gọi DELETE /cart/{id} ───────────────────────── */
let _pendingDeleteId = null;
function askDelete(cartItemId) {
  _pendingDeleteId = cartItemId;
  const btn = document.getElementById('confirmDeleteBtn');
  if (btn) btn.onclick = () => { doDelete(); closeModal('deleteModal'); };
  openModal('deleteModal');
}

async function doDelete() {
  if (!_pendingDeleteId) return;
  try {
    await fetch(`${API_BASE}/cart/${_pendingDeleteId}`, { method: 'DELETE', headers: authH() });
    serverCart = serverCart.filter(x => x.id !== _pendingDeleteId);
    updateBadge();
    renderCartItems();
    showToast('Đã xóa sản phẩm', 'ok');
  } catch {
    showToast('Không thể xóa sản phẩm', 'err');
  }
  _pendingDeleteId = null;
}

/* ── XÓA TẤT CẢ → DELETE /cart/clear ───────────────────────── */
async function clearAll() {
  if (!confirm('Xóa tất cả sản phẩm trong giỏ hàng?')) return;
  try {
    await fetch(`${API_BASE}/cart/clear`, { method: 'DELETE', headers: authH() });
    serverCart = [];
    updateBadge();
    renderCartItems();
    showToast('Đã xóa tất cả', 'ok');
  } catch {
    showToast('Không thể xóa giỏ hàng', 'err');
  }
}

/* ── COUPON ──────────────────────────────────────────────────── */
function applyCoupon() {
  const input = document.getElementById('couponInput');
  const msg   = document.getElementById('couponMsg');
  const code  = (input?.value || '').trim().toUpperCase();
  if (!code) return;
  if (COUPONS[code]) {
    couponApplied = { code, ...COUPONS[code] };
    if (msg) { msg.textContent = `✅ ${couponApplied.label}`; msg.className = 'coupon-msg ok'; }
    showToast(`Áp dụng mã "${code}" thành công!`, 'ok');
  } else {
    couponApplied = null;
    if (msg) { msg.textContent = `⚠️ Mã không hợp lệ `; msg.className = 'coupon-msg err'; }
  }
  updateSummaryDisplays();
}

/* ── PRICE DISPLAYS ──────────────────────────────────────────── */
function updateSummaryDisplays() {
  const sub  = calcSubtotal();
  const disc = calcDiscount(sub);
  const tot  = calcTotal();
  const set  = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  set('sumSubtotal', fmt(sub));
  set('sumTotal',    fmt(tot));
  set('sumDiscount', `−${fmt(disc)}`);
  set('sumShipping', '<span class="c-green">Miễn phí</span>');
  document.getElementById('discountRow')?.classList.toggle('hidden', !couponApplied || disc === 0);
  set('rvSubtotal',  fmt(sub)); set('rvTotal', fmt(tot)); set('rvDiscount', `−${fmt(disc)}`);
  document.getElementById('rvDiscRow')?.classList.toggle('hidden', !couponApplied || disc === 0);
}

function updatePaymentSummary() {
  const sub = calcSubtotal(), disc = calcDiscount(sub), tot = calcTotal();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
  set('pySubtotal', fmt(sub)); set('pyTotal', fmt(tot)); set('pyDiscount', `−${fmt(disc)}`);
  document.getElementById('pyDiscRow')?.classList.toggle('hidden', !couponApplied || disc === 0);
}

function renderReviewList(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = serverCart.map(x => `
    <div class="review-item">
      ${x.image_url
        ? `<img class="review-thumb" src="${x.image_url}" alt="${x.product_name}">`
        : `<div class="review-thumb" style="display:flex;align-items:center;justify-content:center"><i class="fa-solid fa-guitar"></i></div>`}
      <div class="review-name">${x.product_name}<br/><span class="review-qty">× ${x.quantity}</span></div>
      <div class="review-price">${fmt(x.line_total)}</div>
    </div>`).join('');
}

/* ================================================================
   STEP 2 – THÔNG TIN GIAO HÀNG
   ================================================================ */
function populateCities() {
  const sel = document.getElementById('fCity');
  if (!sel) return;
  VN_PROVINCES.forEach(p => { const o = document.createElement('option'); o.value = o.textContent = p; sel.appendChild(o); });
}

function prefillForm() {
  const sv = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  sv('fName',  localStorage.getItem('user_name')  || '');
  sv('fPhone', localStorage.getItem('user_phone') || '');
  sv('fEmail', localStorage.getItem('user_email') || '');
}

function submitInfo() {
  if (!validateForm()) return;
  deliveryInfo = {
    name:     document.getElementById('fName').value.trim(),
    phone:    document.getElementById('fPhone').value.trim(),
    email:    document.getElementById('fEmail').value.trim(),
    street:   document.getElementById('fStreet').value.trim(),
    ward:     document.getElementById('fWard').value.trim(),
    district: document.getElementById('fDistrict').value.trim(),
    city:     document.getElementById('fCity').value,
    note:     document.getElementById('fNote').value.trim(),
  };
  goStep(3);
}

function validateForm() {
  ['errName','errPhone','errStreet','errWard','errDistrict','errCity'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '';
  });
  document.querySelectorAll('.input-wrap.error').forEach(el => el.classList.remove('error'));
  let ok = true;
  const v = id => document.getElementById(id)?.value.trim() || '';
  const e = (eid, msg, fid) => { const el = document.getElementById(eid); if(el) el.textContent = msg; document.getElementById(fid)?.closest('.input-wrap')?.classList.add('error'); ok = false; };
  if (v('fName').length < 2)    e('errName',     'Họ tên ≥ 2 ký tự', 'fName');
  if (!/^(0|\+84)[3578][0-9]{8}$/.test(v('fPhone'))) e('errPhone', 'SĐT không hợp lệ', 'fPhone');
  if (v('fStreet').length < 3)  e('errStreet',   'Nhập số nhà, tên đường', 'fStreet');
  if (v('fWard').length < 2)    e('errWard',     'Nhập phường/xã', 'fWard');
  if (v('fDistrict').length < 2)e('errDistrict', 'Nhập quận/huyện', 'fDistrict');
  if (!document.getElementById('fCity')?.value) e('errCity', 'Chọn tỉnh/thành phố', 'fCity');
  return ok;
}

function renderDeliveryReview() {
  const box = document.getElementById('deliveryReviewBox');
  if (!box || !deliveryInfo) return;
  const addr = [deliveryInfo.street, deliveryInfo.ward, deliveryInfo.district, deliveryInfo.city].filter(Boolean).join(', ');
  box.innerHTML = `
    <div class="dr-row"><span class="dr-label">Tên</span><span class="dr-val">${deliveryInfo.name}</span></div>
    <div class="dr-row"><span class="dr-label">SĐT</span><span class="dr-val">${deliveryInfo.phone}</span></div>
    <div class="dr-row"><span class="dr-label">Địa chỉ</span><span class="dr-val">${addr}</span></div>
    ${deliveryInfo.note ? `<div class="dr-row"><span class="dr-label">Ghi chú</span><span class="dr-val">${deliveryInfo.note}</span></div>` : ''}`;
}

/* ================================================================
   STEP 3 – THANH TOÁN
   ================================================================ */
function selectPayMethod(method) {
  payMethod = method;
  document.getElementById('payCardCod')?.classList.toggle('selected', method === 'cod');
  document.getElementById('payCardBank')?.classList.toggle('selected', method === 'bank');
  const bankBlock = document.getElementById('bankDetailsBlock');
  if (bankBlock) {
    if (method === 'bank') { bankBlock.classList.remove('hidden'); fillBankDetails(); generateQR(); }
    else bankBlock.classList.add('hidden');
  }
  const btn = document.getElementById('btnPlaceOrder');
  if (btn) btn.disabled = false;
}

function fillBankDetails() {
  const total   = calcTotal();
  const preview = currentOrderId || `STR-${new Date().getFullYear()}-PREVIEW`;
  const content = `${(deliveryInfo?.name || 'KHACHHANG').toUpperCase().replace(/\s+/g,'')} ${preview}`;
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
  s('bdBank', BANK.bankFullName); s('bdAccount', BANK.accountNo);
  s('bdOwner', BANK.accountName); s('bdAmount', fmt(total)); s('bdContent', content);
}

function generateQR() {
  const qrImg     = document.getElementById('qrImg');
  const qrLoading = document.getElementById('qrLoading');
  if (!qrImg) return;
  const total   = calcTotal();
  const content = encodeURIComponent(`${(deliveryInfo?.name || 'KHACHHANG').toUpperCase().replace(/\s+/g,'')} ${currentOrderId || 'PREVIEW'}`);
  const url = `https://img.vietqr.io/image/${BANK.bankBin}-${BANK.accountNo}-compact2.png?amount=${total}&addInfo=${content}&accountName=${encodeURIComponent(BANK.accountName)}`;
  qrImg.style.display = 'none';
  if (qrLoading) qrLoading.style.display = 'flex';
  qrImg.src = url;
}
window.onQrLoad  = () => { document.getElementById('qrImg').style.display='block'; document.getElementById('qrLoading').style.display='none'; };
window.onQrError = () => { const el = document.getElementById('qrLoading'); if(el) el.innerHTML='<i class="fa-solid fa-triangle-exclamation" style="color:var(--red)"></i><span>Không tải được QR</span>'; };

function copyEl(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent.trim()).then(() => showToast('Đã sao chép!', 'ok'));
}

/* ================================================================
   ĐẶT HÀNG → POST /orders/checkout
   Backend lấy giỏ hàng từ DB, tính giá, xử lý course enrollment
   ================================================================ */
async function placeOrder() {
  if (!payMethod)    { showToast('Chọn phương thức thanh toán!', 'err'); return; }
  if (!deliveryInfo) { showToast('Thiếu thông tin giao hàng!', 'err'); return; }
  if (!serverCart.length) { showToast('Giỏ hàng trống!', 'err'); return; }

  const btn = document.getElementById('btnPlaceOrder');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...'; }

  const payload = {
    receiver_name:    deliveryInfo.name,
    receiver_phone:   deliveryInfo.phone,
    receiver_email:   deliveryInfo.email || localStorage.getItem('user_email') || '',
    receiver_address: `${deliveryInfo.street}, ${deliveryInfo.ward}, ${deliveryInfo.district}, ${deliveryInfo.city}`,
    note:             deliveryInfo.note || '',
    pay_method:       payMethod,
    coupon_code:      couponApplied?.code || null,
  };

  try {
    const res  = await fetch(`${API_BASE}/orders/checkout`, {
      method: 'POST', headers: authH(), body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.ok || res.status === 201) {
      currentOrderId = data.order_code;
      /* Backend đã xóa cart trên DB; xóa cache local */
      serverCart     = [];
      couponApplied  = null;
      updateBadge();
      renderConfirmPage(data);
      renderStep(4);

      /* Thông báo nếu có khóa học */
      if (data.enrollments?.length) {
        showToast(`🎓 Đã gửi email xác nhận ${data.enrollments.length} khóa học!`, 'ok');
      }
    } else {
      showToast(data.detail || 'Đặt hàng thất bại. Thử lại!', 'err');
    }
  } catch {
    showToast('Không thể kết nối máy chủ', 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Đặt hàng ngay'; }
  }
}

/* ================================================================
   STEP 4 – XÁC NHẬN
   ================================================================ */
function renderConfirmPage(data) {
  setHTML('confirmOrderId', data.order_code || '—');
  setHTML('tlOrdered', new Date().toLocaleString('vi-VN'));

  const itemsList = document.getElementById('confirmItemsList');
  if (itemsList) {
    itemsList.innerHTML = serverCart.map(x => `
      <div class="review-item">
        <div class="review-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--card2)">
          <i class="fa-solid ${x.product_type==='course'?'fa-graduation-cap':'fa-guitar'}" style="color:var(--text3)"></i>
        </div>
        <div class="review-name">${x.product_name}<br/><span class="review-qty">× ${x.quantity}</span></div>
        <div class="review-price">${fmt(x.line_total)}</div>
      </div>`).join('') || '<p style="text-align:center;color:var(--text2);padding:20px">Đặt hàng thành công!</p>';
  }

  /* Hiển thị mã học viên nếu có khóa học */
  if (data.enrollments?.length) {
    const box = document.getElementById('confirmPrices');
    if (box) {
      const enrollHTML = data.enrollments.map(e => `
        <div class="price-row" style="border-top:1px solid var(--border2);padding-top:10px;margin-top:8px">
          <span style="color:var(--blue)"><i class="fa-solid fa-graduation-cap"></i> ${e.course_name}</span>
          <span style="color:var(--gold);font-weight:900">Mã: ${e.student_code}</span>
        </div>`).join('');
      box.innerHTML += enrollHTML;
    }
  }
}

/* ================================================================
   KHỞI TẠO
   ================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  if (!isLoggedIn()) {
    /* Hiện thông báo yêu cầu đăng nhập thay vì redirect */
  }

  populateCities();
  prefillForm();

  /* Load giỏ hàng từ server */
  await fetchCart();
  renderStep(1);

  document.querySelectorAll('.modal-backdrop').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
  });
});

/* ── Expose to window ────────────────────────────────────────── */
window.goStep          = goStep;
window.changeQty       = changeQty;
window.askDelete       = askDelete;
window.doDelete        = doDelete;
window.clearAll        = clearAll;
window.applyCoupon     = applyCoupon;
window.submitInfo      = submitInfo;
window.selectPayMethod = selectPayMethod;
window.copyEl          = copyEl;
window.placeOrder      = placeOrder;
window.openModal       = openModal;
window.closeModal      = closeModal;