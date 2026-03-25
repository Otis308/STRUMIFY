
'use strict';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://wpbmixpiydtbrgcentrt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rcJGMgPHxCdESXDotpweuw_Oew_sz4R';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const CART_STORAGE_KEY = 'strumify_cart';
// --- GLOBAL STATE ---
let cart = []; 

// --- AUTH UTILS ---
function getToken()    { return localStorage.getItem('access_token') || ''; }
function isLoggedIn()  { return !!getToken(); }

// --- PERSISTENCE LOGIC (The crucial fix) ---

// 1. Lưu giỏ hàng: localStorage (for speed) + Database (for persistence)
async function saveCart() {
  // Luôn lưu vào localStorage như một bản cache
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  
  // Đồng bộ số lượng lên badge UI
  const total = cart.reduce((s, x) => s + x.qty, 0);
  document.querySelectorAll('.cart-badge, .cart-count').forEach(el => el.textContent = total);

  // NẾU ĐÃ ĐĂNG NHẬP: Đồng bộ thẳng lên Database của Supabase
  if (isLoggedIn()) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Ta sẽ dùng Supabase query để 'upsert' (insert if new, update if exists)
      const cartItems = cart.map(item => ({
        user_id: user.id, // Supabase yêu cầu user_id để phân quyền
        product_id: item.id,
        quantity: item.qty
      }));
      
      const { error } = await supabase
        .from('cart_items')
        .upsert(cartItems, { onConflict: 'user_id, product_id' }); // Khóa duy nhất (composite key) để composite upsert
        
      if (error) console.error('Error syncing cart to database:', error);
    } catch (err) {
      console.error('Error during database cart sync:', err);
    }
  }
}

// 2. Tải giỏ hàng: Chọn giữa localStorage (guest) và Database (user)
async function loadCart() {
  const localCartStr = localStorage.getItem(CART_STORAGE_KEY);
  let localCart = JSON.parse(localCartStr || '[]');

  // NẾU CHƯA ĐĂNG NHẬP: Dùng local cart của guest
  if (!isLoggedIn()) {
    cart = localCart;
    return;
  }

  // NẾU ĐÃ ĐĂNG NHẬP: Dùng Database làm dữ liệu gốc
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { // Chống lỗi auth nhưng vẫn trả về null
       cart = localCart; return;
    }
    
    // Ta lấy giỏ hàng từ bảng 'cart_items' của Supabase
    // và join thêm bảng 'products' để lấy tên và ảnh
    const { data: dbCart, error } = await supabase
      .from('cart_items')
      .select(`
        id, quantity, product_id,
        products ( id, name, price, image_url )
      `)
      .eq('user_id', user.id); // Supabase chỉ trả về cart của user này
      
    if (error) {
      console.error('Error loading cart from database:', error);
      cart = localCart; // Dự phòng: Dùng local nếu database lỗi
      return;
    }

    // Biến đổi dữ liệu Supabase sang định dạng cart local
    if (dbCart) {
      cart = dbCart.map(item => ({
        id:        item.products.id,
        name:      item.products.name,
        price:     item.products.price,
        image_url: item.products.image_url,
        qty:       item.quantity, // quantity -> qty
        db_item_id: item.id // Lưu lại ID của dòng trong bảng cart_items để sau này xóa
      }));
    } else {
      cart = [];
    }
    
    // Cập nhật lại cache localStorage để các trang khác chạy nhanh hơn
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (err) {
    console.error('Error during database cart load:', err);
    cart = localCart; 
  }
}

// 3. Logic quan trọng: Hợp nhất giỏ hàng (Guest -> User) KHI ĐĂNG NHẬP
async function mergeLocalCartIntoDatabaseCart() {
  const localCartStr = localStorage.getItem(CART_STORAGE_KEY);
  const localCart = JSON.parse(localCartStr || '[]');
  
  if (localCart.length === 0 || !isLoggedIn()) return; // Không có gì để hợp nhất hoặc chưa đăng nhập
  
  console.log('🔄 Merging guest cart into user account...');
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Lấy giỏ hàng database hiện có để so sánh trùng
    const { data: dbCart, error } = await supabase
      .from('cart_items')
      .select('product_id, quantity')
      .eq('user_id', user.id);
      
    if (error) throw error;
    
    // Tạo composite upsert payload:
    // Nếu trùng product_id, ta tăng số lượng. Nếu mới, ta insert mới.
    const upsertItems = localCart.map(localItem => {
      const existingDbItem = dbCart.find(dbItem => dbItem.product_id === localItem.id);
      return {
        user_id: user.id,
        product_id: localItem.id,
        quantity: existingDbItem ? (existingDbItem.quantity + localItem.qty) : localItem.qty
      };
    });
    
    // Thực hiện upsert: Supabase sẽ tự động cập nhật hoặc insert
    const { error: upsertError } = await supabase
      .from('cart_items')
      .upsert(upsertItems, { onConflict: 'user_id, product_id' });
      
    if (upsertError) throw upsertError;
    
    // Hợp nhất thành công: Xóa giỏ hàng guest
    localStorage.removeItem(CART_STORAGE_KEY);
    console.log('✅ Cart merged successfully.');
    
    // Tải lại giỏ hàng đầy đủ từ database về
    await loadCart(); 
    
    // Ép các badge UI cập nhật lại ngay lập tức
    const total = cart.reduce((s, x) => s + x.qty, 0);
    document.querySelectorAll('.cart-badge, .cart-count').forEach(el => el.textContent = total);
  } catch (err) {
    console.error('Failed to merge guest cart:', err);
  }
}

// --- THÊM VÀO GIỎ ---
async function addToCart(id, price) {
  // Ta cần product data đầy đủ để lưu, giả sử PRODUCT_DATA có sẵn trong global
  const pData = (typeof PRODUCT_DATA !== 'undefined') ? PRODUCT_DATA.find(p => p.id === id) : null;
  const existing = cart.find(x => x.id === id);
  
  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      id,
      name:      pData?.name      || `Product #${id}`,
      price:     pData?.price     || price || 0,
      image_url: pData?.image_url || '',
      qty:       1,
    });
  }
  
  // saveCart() đã được sửa để đồng bộ lên Database nếu đã đăng nhập
  await saveCart(); 
  
  // ... (Phần logic render UI như show Toast, update cart sidebar... giữ nguyên) ...
  // Giả sử có renderCartItems() từ file khác gọi sang
  if (typeof renderCartItems === 'function') renderCartItems();
  document.getElementById('cartSidebar')?.classList.add('active');
  document.getElementById('cartOverlay')?.classList.add('active');
  showToast('🛒 Added to cart!');
}

// --- THAY ĐỔI SỐ LƯỢNG ---
async function changeCartQty(id, delta) {
  const item = cart.find(x => x.id === id);
  if (!item) return;
  
  item.qty += delta;
  
  // Nếu quantity <= 0, ta cần xóa sản phẩm khỏi Database
  if (item.qty <= 0) {
    if (isLoggedIn() && item.db_item_id) {
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('id', item.db_item_id);
        if (error) console.error('Error deleting from database cart:', error);
    }
    cart = cart.filter(x => x.id !== id);
  }
  
  // saveCart() sẽ update số lượng mới lên Database
  await saveCart();
  if (typeof renderCartItems === 'function') renderCartItems();
}

// --- XÓA KHỎI GIỎ ---
async function removeFromCart(id) {
  const item = cart.find(x => x.id === id);
  if (!item) return;
  
  if (isLoggedIn() && item.db_item_id) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', item.db_item_id);
    if (error) console.error('Error deleting from database cart:', error);
  }
  
  cart = cart.filter(x => x.id !== id);
  await saveCart();
  if (typeof renderCartItems === 'function') renderCartItems();
}

// --- INIT (LƯU Ý) ---
document.addEventListener('DOMContentLoaded', async () => {
  // Ép buộc tải giỏ hàng mới nhất từ database về
  await loadCart();
  
  // ... (Phần UI init khác...) ...
  // renderCartItems() ... 
});

// Xuất các hàm ra để profile.js gọi khi đăng nhập thành công
export { changeCartQty, removeFromCart, addToCart, loadCart, mergeLocalCartIntoDatabaseCart };

/* ── STATE ──────────────────────────────────────────────────────── */
let couponApplied = null;        
let deliveryInfo  = null;        
let payMethod     = null;        
let pendingDelete = null;        
let currentStep   = 1;
let currentOrderId = null;
let _toastTimer   = null;
         
let CATALOG = {}; 

const COUPONS = {
  'MOC10':   { type:'percent', value:10,      label:'Giảm 10%' },
  'MOC20':   { type:'percent', value:20,      label:'Giảm 20%' },
  'MOC30':   { type:'percent', value:30,      label:'Giảm 30%' },
  'NEWUSER': { type:'percent', value:15,      label:'Khách mới -15%' },
  'GUITAR50':{ type:'fixed',   value:500000,  label:'Giảm 500.000₫' },
  'SALE100': { type:'fixed',   value:1000000, label:'Giảm 1.000.000₫' },
  'VIP25':   { type:'percent', value:25,      label:'VIP -25%' },
};

/* ── CẤU HÌNH NGÂN HÀNG ─────────────────────────────────────────
    BIN: VCB=970436 | TCB=970407 | MB=970422 | ACB=970416
         VPB=970432 | BIDV=970418 | VTB=970415 | TPB=970423     
*/
const BANK = {
  bankBin:     '970422',                       // BIN 
  accountNo:   '89779799999',                   // STK
  accountName: 'CONG TY TNHH MOC INSTRUMENT', //  TÊN CHỦ TK 
  bankFullName:'MB',
  branch:      'CN TP. Hồ Chí Minh',
};

/* ── ENDPOINT API ────────────────────────────────────────────── */
const API_BASE = ''; // để trống = same origin, hoặc 'http://localhost:8000'

/* ── DANH SÁCH TỈNH/TP VIỆT NAM ─────────────────────────────── */
const VN_PROVINCES =
[
  'An Giang','Bà Rịa - Vũng Tàu','Bạc Liêu','Bắc Giang','Bắc Kạn',
  'Bắc Ninh','Bến Tre','Bình Dương','Bình Định','Bình Phước',
  'Bình Thuận','Cà Mau','Cao Bằng','Cần Thơ','Đà Nẵng',
  'Đắk Lắk','Đắk Nông','Điện Biên','Đồng Nai','Đồng Tháp',
  'Gia Lai','Hà Giang','Hà Nam','Hà Nội','Hà Tĩnh',
  'Hải Dương','Hải Phòng','Hậu Giang','Hòa Bình','Hưng Yên',
  'Khánh Hòa','Kiên Giang','Kon Tum','Lai Châu','Lạng Sơn',
  'Lào Cai','Lâm Đồng','Long An','Nam Định','Nghệ An',
  'Ninh Bình','Ninh Thuận','Phú Thọ','Phú Yên','Quảng Bình',
  'Quảng Nam','Quảng Ngãi','Quảng Ninh','Quảng Trị','Sóc Trăng',
  'Sơn La','Tây Ninh','Thái Bình','Thái Nguyên','Thanh Hóa',
  'Thừa Thiên Huế','Tiền Giang','TP. Hồ Chí Minh','Trà Vinh',
  'Tuyên Quang','Vĩnh Long','Vĩnh Phúc','Yên Bái',
];

/* ── FREESHIP THRESHOLD ──────────────────────────────────────── */
const FREE_SHIP_THRESHOLD = 50_000_000; // ≥ 50tr → miễn phí
const SHIP_FEE = 20000; // đặt về 0 = luôn miễn phí, tăng nếu muốn tính phí

/* ================================================================
   KHỞI TẠO – fetch products từ Supabase API trước, rồi mới render
   ================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  populateCities();
  prefillForm();
  showLoading(true);

  await fetchProducts();
  loadCart();           
  renderStep(1);
  showLoading(false);
});

/* ── FETCH PRODUCTS TỪ SUPABASE API ─────────────────────────── */
/* ── HELPER: clean giá trị None từ Python ────────────────────── */
function cleanVal(v, fallback = '') {
  if (v === null || v === undefined) return fallback;
  if (String(v).trim().toLowerCase() === 'none') return fallback;
  return v;
}

/* ── HELPER: render sao đánh giá ────────────────────────────── */
function renderStars(rating) {
  const r     = parseFloat(rating) || 0;
  const full  = Math.floor(r);
  const half  = r - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    '<span class="prod-stars">' +
    '<i class="fa-solid fa-star"></i>'.repeat(full) +
    (half ? '<i class="fa-solid fa-star-half-stroke"></i>' : '') +
    '<i class="fa-regular fa-star"></i>'.repeat(empty) +
    '</span>'
  );
}

/* ── BIẾN PRODUCT GRID ───────────────────────────────────────── */
let allProducts = [];
let filteredProducts = [];

async function fetchProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();

    // Normalize + clean None values
    allProducts = raw.map(p => ({
      ...p,
      id:          Number(p.id),
      name:        cleanVal(p.name,        'Sản phẩm'),
      description: cleanVal(p.description, ''),
      cat:         cleanVal(p.cat,         ''),
      brand:       cleanVal(p.brand,       ''),
      badge:       cleanVal(p.badge,       ''),
      img:         p.image_url || p.img || '',   
      image_url:   p.image_url || p.img || '',
      price:       parseFloat(p.price)  || 0,
      orig:        parseFloat(p.orig)   || 0,
      rating:      parseFloat(p.rating) || 0,
      reviews:     parseInt(p.reviews)  || 0,
    }));

    // Sync vào CATALOG cho cart
    allProducts.forEach(p => { CATALOG[p.id] = p; });
    filteredProducts = [...allProducts];

    console.log(`[cart.js] Loaded ${allProducts.length} products into CATALOG`);

    // Render grid nếu trang có #productGrid
    if (document.getElementById('productGrid')) {
      buildCategoryTabs();
      renderProductGrid(filteredProducts);
      initProductSearch();
      injectProductGridStyles();
      ensureDetailModal();
    }

  } catch (err) {
    console.error('[cart.js] fetchProducts failed:', err);
    showToast('Không tải được danh sách sản phẩm. Vui lòng thử lại.', 'err');
  }
}

/* ── LOADING STATE ───────────────────────────────────────────── */
function showLoading(on) {
  // Hiển thị skeleton / spinner trong items-col khi đang fetch
  const list = document.getElementById('cartItemsList');
  if (!list) return;
  if (on) {
    list.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        ${[1,2,3].map(()=>`
          <div style="height:96px;background:var(--card,#1a1e2b);border-radius:12px;
               border:1px solid var(--border,#272d40);animation:pulse 1.4s infinite">
          </div>`).join('')}
      </div>`;
  }
}

/* ── ĐỌC GIỎ HÀNG TỪ SESSIONSTORAGE (Đã tách riêng từng User) ── */
function getCartKey() {
  // Lấy ID người dùng, nếu chưa đăng nhập thì gọi là 'guest'
  const uid = sessionStorage.getItem('user_id') || 'guest';
  return 'moc_cart_' + uid;
}

function loadCart() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(getCartKey()) || '[]');
    if (Object.keys(CATALOG).length > 0) {
      cart = raw.map(x => ({ ...x, id: Number(x.id) })).filter(x => CATALOG[x.id] && x.qty > 0);
    } else {
      cart = raw.map(x => ({ ...x, id: Number(x.id) })).filter(x => x.qty > 0);
    }
  } catch {
    cart = [];
  }
  saveCart();
}

function saveCart() {
  sessionStorage.setItem(getCartKey(), JSON.stringify(cart));
  const total = cart.reduce((s, x) => s + x.qty, 0);
  document.querySelectorAll('.cart-badge, .cart-count').forEach(el => el.textContent = total);
}

/* ── ĐIỀN CÁC TỈNH THÀNH VÀO SELECT ────────────────────────── */
function populateCities() {
  const sel = document.getElementById('fCity');
  if (!sel) return;
  VN_PROVINCES.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p; opt.textContent = p;
    sel.appendChild(opt);
  });
}

/* ── PRE-FILL FORM TỪ LOCALSTORAGE / PROFILE ───────────────── */
function prefillForm() {
  setVal('fName',  localStorage.getItem('user_name')    || localStorage.getItem('moc_name')    || '');
  setVal('fPhone', localStorage.getItem('moc_phone')    || '');
  setVal('fEmail', localStorage.getItem('user_email')   || localStorage.getItem('moc_email')  || '');
  setVal('fNote',  '');
}
function setVal(id, v) { const el = document.getElementById(id); if (el && v) el.value = v; }

/* 
   ĐIỀU HƯỚNG BƯỚC
*/
function goStep(n) {
  if (n >= 2 && !localStorage.getItem('access_token')) {
    openModal('loginModal');
    return;
  }
  if (n === 2 && !cart.length) {
    showToast('Giỏ hàng trống!', 'err');
    return;
  }
  currentStep = n;
  renderStep(n);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderStep(n) {
  for (let i = 1; i <= 4; i++) {
    const sec = document.getElementById(`section${i}`);
    if (sec) sec.classList.toggle('active', i === n);
    if (sec) sec.classList.toggle('hidden', i !== n);
  }
  for (let i = 1; i <= 4; i++) {
    const si = document.getElementById(`stepItem${i}`);
    if (!si) continue;
    si.classList.remove('active', 'done');
    if (i < n)  si.classList.add('done');
    if (i === n) si.classList.add('active');
  }
  // Connectors
  for (let i = 1; i <= 3; i++) {
    const c = document.getElementById(`conn${i}`);
    if (c) c.classList.toggle('done', i < n);
  }
  // Render content per step
  if (n === 1) renderCartItems();
  if (n === 2) { renderCartItems(); renderReviewList('reviewList'); updateSummaryDisplays(); }
  if (n === 3) { renderReviewList('payReviewList'); renderDeliveryReview(); updatePaymentSummary(); }
}

/* ================================================================
   RENDER GIỎ HÀNG (STEP 1)
   ================================================================ */
function renderCartItems() {
  const list    = document.getElementById('cartItemsList');
  const empty   = document.getElementById('emptyCart');
  const clearBtn= document.getElementById('btnClearAll');
  const countEl = document.getElementById('itemsCount');
  const ctaBtn  = document.getElementById('btnToStep2');
  if (!list) return;

  const totalQty = cart.reduce((s, x) => s + x.qty, 0);
  if (countEl) countEl.textContent = `${totalQty} sản phẩm`;
  if (ctaBtn)  ctaBtn.disabled = !cart.length;

  if (!cart.length) {
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    clearBtn?.classList.add('hidden');
    updateSummaryDisplays();
    return;
  }
  empty?.classList.add('hidden');
  clearBtn?.classList.remove('hidden');

  list.innerHTML = cart.map(x => {
    const p = CATALOG[x.id];
    if (!p) return '';
    const linePrice = p.price * x.qty;
    return `
    <div class="cart-item-card" id="cartCard${x.id}">
      ${p.img
        ? `<img class="item-thumb" src="${p.img}" alt="${p.name}" loading="lazy"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ''
      }
      <div class="item-thumb-placeholder" style="${p.img ? 'display:none' : ''}">
        <i class="fa-solid fa-guitar"></i>
      </div>
      <div class="item-info">
        <span class="item-cat">${p.cat}</span>
        <div class="item-name" title="${p.name}">${p.name}</div>
        <div class="item-unit-price">
          ${fmt(p.price)}/cái
          ${p.orig ? `<span class="orig">${fmt(p.orig)}</span>` : ''}
        </div>
      </div>
      <div class="item-controls">
        <div class="qty-block">
          <button class="qty-btn" onclick="changeQty(${x.id}, -1)" aria-label="Giảm">−</button>
          <span class="qty-val">${x.qty}</span>
          <button class="qty-btn" onclick="changeQty(${x.id}, +1)" aria-label="Tăng">+</button>
        </div>
        <div class="item-line-price">${fmt(linePrice)}</div>
        <button class="item-delete" onclick="askDelete(${x.id})" aria-label="Xóa">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>`;
  }).join('');

  updateSummaryDisplays();
}

/* ── THAY ĐỔI SỐ LƯỢNG ─────────────────────────────────────── */
function changeQty(id, delta) {
  const item = cart.find(x => x.id === id);
  if (!item) return;
  const newQty = item.qty + delta;
  if (newQty <= 0) {
    askDelete(id);
    return;
  }
  item.qty = newQty;
  saveCart();
  renderCartItems();
  if (currentStep === 2) { renderReviewList('reviewList'); updateSummaryDisplays(); }
  if (currentStep === 3) { renderReviewList('payReviewList'); updatePaymentSummary(); }
}

/* ── XÓA SẢN PHẨM ───────────────────────────────────────────── */
function askDelete(id) {
  pendingDelete = id;
  const btn = document.getElementById('confirmDeleteBtn');
  if (btn) btn.onclick = () => { doDelete(id); closeModal('deleteModal'); };
  openModal('deleteModal');
}
function doDelete(id) {
  cart = cart.filter(x => x.id !== id);
  saveCart();
  renderCartItems();
  showToast('Đã xóa sản phẩm khỏi giỏ hàng', 'ok');
}

/* ── XÓA TẤT CẢ ─────────────────────────────────────────────── */
function clearAll() {
  if (!confirm('Xóa tất cả sản phẩm trong giỏ hàng?')) return;
  cart = [];
  saveCart();
  renderCartItems();
  showToast('Đã xóa tất cả sản phẩm', 'ok');
}

/* ── TÍNH TOÁN ───────────────────────────────────────────────── */
function calcSubtotal() {
  return cart.reduce((s, x) => s + (CATALOG[x.id]?.price || 0) * x.qty, 0);
}
function calcDiscount(sub) {
  if (!couponApplied) return 0;
  if (couponApplied.type === 'percent') return Math.round(sub * couponApplied.value / 100);
  return Math.min(couponApplied.value, sub);
}
function calcShipping(sub) {
  return (SHIP_FEE === 0 || sub >= FREE_SHIP_THRESHOLD) ? 0 : SHIP_FEE;
}
function calcTotal() {
  const sub  = calcSubtotal();
  const disc = calcDiscount(sub);
  const ship = calcShipping(sub);
  return Math.max(0, sub - disc + ship);
}

/* ── CẬP NHẬT HIỂN THỊ GIÁ ──────────────────────────────────── */
function updateSummaryDisplays() {
  const sub  = calcSubtotal();
  const disc = calcDiscount(sub);
  const ship = calcShipping(sub);
  const tot  = Math.max(0, sub - disc + ship);

  // Step 1
  setHTML('sumSubtotal', fmt(sub));
  setHTML('sumTotal', fmt(tot));
  const dRow = document.getElementById('discountRow');
  if (dRow) dRow.classList.toggle('hidden', !couponApplied || disc === 0);
  setHTML('sumDiscount', `−${fmt(disc)}`);
  setHTML('sumShipping', ship === 0 ? '<span class="c-green">Miễn phí</span>' : fmt(ship));

  // Step 2
  setHTML('rvSubtotal', fmt(sub));
  setHTML('rvTotal', fmt(tot));
  setHTML('rvDiscount', `−${fmt(disc)}`);
  const rvDRow = document.getElementById('rvDiscRow');
  if (rvDRow) rvDRow.classList.toggle('hidden', !couponApplied || disc === 0);
}

function updatePaymentSummary() {
  const sub  = calcSubtotal();
  const disc = calcDiscount(sub);
  const ship = calcShipping(sub);
  const tot  = Math.max(0, sub - disc + ship);
  setHTML('pySubtotal', fmt(sub));
  setHTML('pyTotal', fmt(tot));
  setHTML('pyDiscount', `−${fmt(disc)}`);
  const pyDRow = document.getElementById('pyDiscRow');
  if (pyDRow) pyDRow.classList.toggle('hidden', !couponApplied || disc === 0);
}

/* ── MÃ GIẢM GIÁ ────────────────────────────────────────────── */
function applyCoupon() {
  const input = document.getElementById('couponInput');
  const msg   = document.getElementById('couponMsg');
  if (!input || !msg) return;

  const code = input.value.trim().toUpperCase();
  if (!code) {
    showCouponMsg('Vui lòng nhập mã giảm giá', 'err');
    return;
  }
  if (COUPONS[code]) {
    couponApplied = { code, ...COUPONS[code] };
    showCouponMsg(`✓ Áp dụng: ${COUPONS[code].label}`, 'ok');
    updateSummaryDisplays();
    showToast(`Áp dụng mã ${code} thành công!`, 'ok');
  } else {
    // Kiểm tra coupons từ admin
    const adminCoupons = JSON.parse(localStorage.getItem('admin_coupons') || '[]');
    const found = adminCoupons.find(c => c.code === code && c.active);
    if (found) {
      couponApplied = { code: found.code, type: found.type, value: found.val, label: `Giảm ${found.type === 'percent' ? found.val + '%' : fmt(found.val)}` };
      showCouponMsg(`✓ Áp dụng: ${couponApplied.label}`, 'ok');
      updateSummaryDisplays();
      showToast(`Áp dụng mã ${code} thành công!`, 'ok');
    } else {
      couponApplied = null;
      showCouponMsg(`✗ Mã "${code}" không hợp lệ hoặc đã hết hạn`, 'err');
      updateSummaryDisplays();
    }
  }
}

function showCouponMsg(text, type) {
  const msg = document.getElementById('couponMsg');
  if (!msg) return;
  msg.textContent = text;
  msg.className = `coupon-msg ${type}`;
}

/* ── RENDER REVIEW LIST (sidebar nhỏ) ───────────────────────── */
function renderReviewList(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = cart.map(x => {
    const p = CATALOG[x.id];
    if (!p) return '';
    return `
    <div class="review-item">
      ${it.img
        ? `<img class="review-thumb" src="${it.img}" alt="${it.name}" loading="lazy"
              onerror="this.onerror=null;this.style.display='none'">`
        : `<div class="review-thumb" style="display:flex;align-items:center;justify-content:center">
            <i class="fa-solid fa-guitar" style="color:var(--text3)"></i>
          </div>`
      }
      <div class="review-name">${p.name}<br/><span class="review-qty">× ${x.qty}</span></div>
      <div class="review-price">${fmt(p.price * x.qty)}</div>
    </div>`;
  }).join('');
}

/* ================================================================
   STEP 2: VALIDATE & LƯU THÔNG TIN GIAO HÀNG
   ================================================================ */
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

  // Lưu cho lần sau
  localStorage.setItem('moc_name',    deliveryInfo.name);
  localStorage.setItem('moc_phone',   deliveryInfo.phone);
  localStorage.setItem('moc_email',   deliveryInfo.email);

  goStep(3);
}

function validateForm() {
  let ok = true;
  clearErrors();

  const name     = document.getElementById('fName').value.trim();
  const phone    = document.getElementById('fPhone').value.trim();
  const street   = document.getElementById('fStreet').value.trim();
  const ward     = document.getElementById('fWard').value.trim();
  const district = document.getElementById('fDistrict').value.trim();
  const city     = document.getElementById('fCity').value;

  if (name.length < 2) {
    setErr('errName', 'Họ tên phải có ít nhất 2 ký tự');
    markError('fName');
    ok = false;
  }
  if (!/^(0|\+84)[3|5|7|8|9][0-9]{8}$/.test(phone)) {
    setErr('errPhone', 'Số điện thoại VN không hợp lệ (VD: 0901234567)');
    markError('fPhone');
    ok = false;
  }
  if (street.length < 3) {
    setErr('errStreet', 'Vui lòng nhập số nhà, tên đường');
    markError('fStreet');
    ok = false;
  }
  if (ward.length < 2) {
    setErr('errWard', 'Vui lòng nhập phường/xã');
    markError('fWard');
    ok = false;
  }
  if (district.length < 2) {
    setErr('errDistrict', 'Vui lòng nhập quận/huyện');
    markError('fDistrict');
    ok = false;
  }
  if (!city) {
    setErr('errCity', 'Vui lòng chọn tỉnh/thành phố');
    markError('fCity');
    ok = false;
  }

  if (!ok) {
    // Scroll tới lỗi đầu tiên
    const firstErr = document.querySelector('.f-err:not(:empty)');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return ok;
}

function clearErrors() {
  ['errName','errPhone','errStreet','errWard','errDistrict','errCity'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  document.querySelectorAll('.input-wrap.error').forEach(el => el.classList.remove('error'));
}
function setErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}
function markError(fieldId) {
  const el = document.getElementById(fieldId);
  if (el) el.closest('.input-wrap')?.classList.add('error');
}

/* ── RENDER DELIVERY REVIEW ─────────────────────────────────── */
function renderDeliveryReview() {
  const box = document.getElementById('deliveryReviewBox');
  if (!box || !deliveryInfo) return;
  const fullAddr = [deliveryInfo.street, deliveryInfo.ward, deliveryInfo.district, deliveryInfo.city]
    .filter(Boolean).join(', ');
  box.innerHTML = `
    <div class="dr-row">
      <span class="dr-label"><i class="fa-solid fa-user"></i> Tên</span>
      <span class="dr-val">${deliveryInfo.name}</span>
    </div>
    <div class="dr-row">
      <span class="dr-label"><i class="fa-solid fa-phone"></i> SĐT</span>
      <span class="dr-val">${deliveryInfo.phone}</span>
    </div>
    <div class="dr-row">
      <span class="dr-label"><i class="fa-solid fa-location-dot"></i> Địa chỉ</span>
      <span class="dr-val">${fullAddr}</span>
    </div>
    ${deliveryInfo.note ? `
    <div class="dr-row">
      <span class="dr-label"><i class="fa-solid fa-note-sticky"></i> Ghi chú</span>
      <span class="dr-val">${deliveryInfo.note}</span>
    </div>` : ''}`;
}

/* ================================================================
   STEP 3: CHỌN PHƯƠNG THỨC THANH TOÁN
   ================================================================ */
function selectPayMethod(method) {
  payMethod = method;

  // Visual
  document.getElementById('payCardCod')?.classList.toggle('selected', method === 'cod');
  document.getElementById('payCardBank')?.classList.toggle('selected', method === 'bank');
  document.getElementById('radioCod')?.closest('.pay-option-card')?.classList.toggle('selected', method === 'cod');
  document.getElementById('radioBank')?.closest('.pay-option-card')?.classList.toggle('selected', method === 'bank');

  // Bank details
  const bankBlock = document.getElementById('bankDetailsBlock');
  if (bankBlock) {
    if (method === 'bank') {
      bankBlock.classList.remove('hidden');
      fillBankDetails();
      generateQR();
    } else {
      bankBlock.classList.add('hidden');
    }
  }

  // Enable place order
  const btn = document.getElementById('btnPlaceOrder');
  if (btn) btn.disabled = false;
}

function fillBankDetails() {
  const total = calcTotal();
  const preview = currentOrderId || `MOC-${new Date().getFullYear()}-PREVIEW`;
  const content = `${deliveryInfo?.name?.toUpperCase().replace(/\s+/g,'') || 'KHACHHANG'} ${preview}`;

  setHTML('bdBank',    BANK.bankFullName + ' – ' + BANK.branch);
  setHTML('bdAccount', BANK.accountNo);
  setHTML('bdOwner',   BANK.accountName);
  setHTML('bdAmount',  fmt(total));
  setHTML('bdContent', content);
}

/* ── GENERATE VIETQR ─────────────────────────────────────────── */
function generateQR() {
  const qrImg     = document.getElementById('qrImg');
  const qrLoading = document.getElementById('qrLoading');
  if (!qrImg || !qrLoading) return;

  const total   = calcTotal();
  const preview = currentOrderId || `MOC-${new Date().getFullYear()}-PREVIEW`;
  const content = encodeURIComponent(
    `${(deliveryInfo?.name || 'KHACHHANG').toUpperCase().replace(/\s+/g,'')} ${preview}`
  );
  const ownerEnc  = encodeURIComponent(BANK.accountName);

  /* VietQR API – chuẩn quốc gia, hoạt động với tất cả app ngân hàng VN */
  const url = `https://img.vietqr.io/image/${BANK.bankBin}-${BANK.accountNo}-compact2.png` +
              `?amount=${total}&addInfo=${content}&accountName=${ownerEnc}`;

  qrImg.style.display = 'none';
  qrLoading.style.display = 'flex';
  qrImg.src = url;
}

function onQrLoad() {
  const qrImg     = document.getElementById('qrImg');
  const qrLoading = document.getElementById('qrLoading');
  if (qrImg)     qrImg.style.display = 'block';
  if (qrLoading) qrLoading.style.display = 'none';
}
function onQrError() {
  const qrLoading = document.getElementById('qrLoading');
  if (qrLoading) qrLoading.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--red);font-size:24px"></i><span style="font-size:12px">Không tải được QR</span>';
}

/* ── SAO CHÉP VĂN BẢN ────────────────────────────────────────── */
function copyEl(elementId) {
  const el  = document.getElementById(elementId);
  const btn = el?.parentElement?.querySelector('.btn-copy');
  if (!el) return;
  navigator.clipboard.writeText(el.textContent.trim()).then(() => {
    if (btn) {
      btn.classList.add('copied');
      btn.innerHTML = '<i class="fa-solid fa-check"></i>';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = '<i class="fa-regular fa-copy"></i>';
      }, 2000);
    }
    showToast('Đã sao chép!', 'ok');
  }).catch(() => showToast('Không thể sao chép', 'err'));
}

/* ================================================================
   ĐẶT HÀNG
   ================================================================
   ⚠️ QUAN TRỌNG – BẢO MẬT GIÁ:
   Frontend CHỈ gửi {id, qty} lên backend.
   Backend PHẢI tự lấy giá từ DB → tính tổng.
   Không bao giờ tin giá tiền từ client.
   ================================================================ */
async function placeOrder() {
  if (!payMethod) {
    showToast('Vui lòng chọn phương thức thanh toán!', 'err');
    return;
  }
  if (!deliveryInfo) {
    showToast('Thiếu thông tin giao hàng!', 'err');
    return;
  }
  if (!cart.length) {
    showToast('Giỏ hàng trống!', 'err');
    return;
  }

  const btn = document.getElementById('btnPlaceOrder');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...'; }

  /* Tạo order ID */
  const counter = parseInt(localStorage.getItem('moc_order_counter') || '340') + 1;
  localStorage.setItem('moc_order_counter', counter);
  currentOrderId = `MOC-${new Date().getFullYear()}-${String(counter).padStart(5,'0')}`;

  /* Payload gửi backend – GIÁ TIỀN TÍNH BACKEND */
  const payload = {
    orderId:      currentOrderId,
    items:        cart.map(x => ({ id: x.id, qty: x.qty })), // ← chỉ id + qty
    coupon:       couponApplied?.code || null,
    payMethod,
    delivery:     deliveryInfo,
    clientTotal:  calcTotal(),  // chỉ để hiển thị, backend không dùng
  };

  /* === GỬI LÊN API (uncomment khi có backend) ===
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Lỗi đặt hàng');
    }
    const data = await res.json();
    currentOrderId = data.orderId || currentOrderId;
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'err');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Đặt hàng ngay'; }
    return;
  }
  */

  /* Lưu vào localStorage (dùng khi chưa có backend) */
  const sub  = calcSubtotal();
  const disc = calcDiscount(sub);
  const tot  = calcTotal();
  const now  = new Date();

  const newOrder = {
    id:       currentOrderId,
    date:     now.toLocaleDateString('vi-VN'),
    datetime: now.toISOString(),
    name:     deliveryInfo.name,
    phone:    deliveryInfo.phone,
    email:    deliveryInfo.email,
    address:  `${deliveryInfo.street}, ${deliveryInfo.ward}, ${deliveryInfo.district}, ${deliveryInfo.city}`,
    note:     deliveryInfo.note,
    items:    cart.map(x => ({
      id: x.id, qty: x.qty,
      name:  CATALOG[x.id]?.name  || '',
      price: CATALOG[x.id]?.price || 0,
      img: CATALOG[x.id]?.image_url || CATALOG[x.id]?.img || '',
    })),
    coupon:   couponApplied?.code || null,
    subtotal: sub,
    discount: disc,
    total:    tot,
    method:   payMethod,
    status:   'processing',
    tracking: [
      { key: 'ordered',   label: 'Đặt hàng thành công', time: now.toLocaleString('vi-VN'), done: true },
      { key: 'confirmed', label: 'Xác nhận đơn hàng',   time: null, done: false },
      { key: 'processing',label: 'Xuất kho & đóng gói', time: null, done: false },
      { key: 'shipping',  label: 'Đang vận chuyển',      time: null, done: false },
      { key: 'arrived',   label: 'Đã đến nơi giao',      time: null, done: false },
      { key: 'delivered', label: 'Đã nhận hàng',         time: null, done: false },
    ],
  };

  const orders = JSON.parse(localStorage.getItem('moc_orders') || '[]');
  orders.unshift(newOrder);
  localStorage.setItem('moc_orders', JSON.stringify(orders));

  /* Xóa giỏ hàng */
  cart = [];
  couponApplied = null;
  saveCart();

  /* Hiển thị xác nhận */
  renderConfirmPage(newOrder);
  renderStep(4);

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Đặt hàng ngay'; }
}

/* ================================================================
   STEP 4: XÁC NHẬN & TRACKING
   ================================================================ */
function renderConfirmPage(order) {
  /* Order ID tag */
  setHTML('confirmOrderId', order.id);

  /* Timeline */
  renderTracking(order.tracking);

  /* Danh sách sản phẩm */
  const itemsList = document.getElementById('confirmItemsList');
  if (itemsList) {
    itemsList.innerHTML = order.items.map(it => `
      <div class="review-item">
        ${it.img
          ? `<img class="review-thumb" src="${it.img}" alt="${it.name}" loading="lazy" onerror="this.onerror=null;this.style.display='none'">`
          : `<div class="review-thumb" style="display:flex;align-items:center;justify-content:center"><i class="fa-solid fa-guitar" style="color:var(--text3)"></i></div>`
        }
        <div class="review-name">${it.name}<br/><span class="review-qty">× ${it.qty}</span></div>
        <div class="review-price">${fmt(it.price * it.qty)}</div>
      </div>`).join('');
  }

  /* Prices */
  const prices = document.getElementById('confirmPrices');
  if (prices) {
    prices.innerHTML = `
      <div class="price-row"><span>Tạm tính</span><span>${fmt(order.subtotal)}</span></div>
      ${order.discount > 0 ? `<div class="price-row green-row"><span>Giảm giá (${order.coupon})</span><span class="c-green">−${fmt(order.discount)}</span></div>` : ''}
      <div class="price-row"><span>Phí vận chuyển</span><span class="c-green">Miễn phí</span></div>
      <div class="price-row total-row"><span>Tổng thanh toán</span><span class="total-price">${fmt(order.total)}</span></div>`;
  }

  /* Timeline time đặt hàng */
  setHTML('tlOrdered', order.tracking[0]?.time || order.datetime);
}

/* ── RENDER TRACKING TIMELINE ────────────────────────────────── */
function renderTracking(trackingSteps) {
  if (!trackingSteps) return;
  const tl = document.getElementById('timeline');
  if (!tl) return;

  const items = tl.querySelectorAll('.tl-item');
  let foundActive = false;

  items.forEach(item => {
    const key  = item.dataset.key;
    const step = trackingSteps.find(t => t.key === key);
    if (!step) return;

    item.classList.remove('done', 'active');
    const timeEl = item.querySelector('.tl-time');

    if (step.done) {
      item.classList.add('done');
      if (timeEl && step.time) timeEl.textContent = step.time;
    } else if (!foundActive) {
      item.classList.add('active');
      foundActive = true;
    }
  });
}

/* ── CẬP NHẬT TRACKING TỪ PROFILE/ADMIN ─────────────────────── */
function refreshTrackingFromStorage(orderId) {
  const orders = JSON.parse(localStorage.getItem('moc_orders') || '[]');
  const order  = orders.find(o => o.id === orderId);
  if (!order) return;

  // Map status đơn giản sang tracking steps
  const statusMap = {
    processing: ['ordered'],
    confirmed:  ['ordered','confirmed'],
    shipping:   ['ordered','confirmed','processing','shipping'],
    arrived:    ['ordered','confirmed','processing','shipping','arrived'],
    delivered:  ['ordered','confirmed','processing','shipping','arrived','delivered'],
  };
  const doneKeys = statusMap[order.status] || ['ordered'];
  if (order.tracking) {
    order.tracking.forEach(t => { t.done = doneKeys.includes(t.key); });
    renderTracking(order.tracking);
  }
}

/* ================================================================
   HELPER FUNCTIONS
   ================================================================ */
function fmt(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
}
function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}
function openModal(id)  { const el = document.getElementById(id); if (el) el.classList.add('open'); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }

/* Click backdrop to close modal */
document.querySelectorAll('.modal-backdrop').forEach(el => {
  el.addEventListener('click', e => {
    if (e.target === el) el.classList.remove('open');
  });
});

/* ── TOAST ────────────────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  const toast = document.getElementById('pageToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `page-toast show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ================================================================
   PRODUCT GRID – render lưới sản phẩm trên trang /order
   Layout: Ảnh → Tên → Đánh giá → Giá
   ================================================================ */

/* ── RENDER GRID ─────────────────────────────────────────────── */
function renderProductGrid(products) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  // Update count
  const cnt = document.getElementById('productCount');
  if (cnt) cnt.textContent = products.length + ' sản phẩm';

  if (!products.length) {
    grid.innerHTML = `
      <div class="pg-empty">
        <i class="fa-solid fa-magnifying-glass"></i>
        <p>Không tìm thấy sản phẩm phù hợp.</p>
      </div>`;
    return;
  }

  grid.innerHTML = products.map(p => {
    const discount = p.orig > p.price && p.orig > 0
      ? Math.round((1 - p.price / p.orig) * 100) : 0;

    return `
      <div class="pg-card" data-id="${p.id}">

        <!-- 1. Hình ảnh -->
        <div class="pg-img-wrap" onclick="openProductDetail(${p.id})">
          ${p.img
            ? `<img src="${p.img}" alt="${p.name}" loading="lazy"
                    onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''
          }
          <div class="pg-img-ph" style="${p.img ? 'display:none' : ''}">
            <i class="fa-solid fa-guitar"></i>
          </div>
          ${p.badge   ? `<span class="pg-badge">${p.badge}</span>` : ''}
          ${discount>0 ? `<span class="pg-disc">-${discount}%</span>` : ''}
        </div>

        <div class="pg-body">
          <!-- 2. Tên sản phẩm -->
          <h3 class="pg-name" onclick="openProductDetail(${p.id})">${p.name}</h3>

          <!-- 3. Đánh giá -->
          <div class="pg-rating">
            ${p.rating > 0
              ? `${renderStars(p.rating)}
                 <span class="pg-rating-num">${p.rating.toFixed(1)}</span>
                 ${p.reviews > 0 ? `<span class="pg-reviews">(${p.reviews})</span>` : ''}`
              : '<span class="pg-no-rating">Chưa có đánh giá</span>'
            }
          </div>

          <!-- 4. Giá -->
          <div class="pg-price-row">
            <span class="pg-price">${fmt(p.price)}</span>
            ${p.orig > p.price ? `<span class="pg-orig">${fmt(p.orig)}</span>` : ''}
          </div>

          <!-- Nút -->
          <div class="pg-actions">
            <button class="pg-btn-detail" onclick="openProductDetail(${p.id})">
              <i class="fa-solid fa-eye"></i> Chi tiết
            </button>
            <button class="pg-btn-add" onclick="addProductToCart(${p.id})">
              <i class="fa-solid fa-cart-plus"></i>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ── CATEGORY TABS ───────────────────────────────────────────── */
function buildCategoryTabs() {
  const bar = document.getElementById('categoryBar');
  if (!bar) return;

  const cats = [...new Set(allProducts.map(p => p.cat).filter(Boolean))].sort();
  const catIcons = {
    'Guitar':'fa-guitar','Violin':'fa-music','Piano':'fa-music',
    'Drum':'fa-drum','Flute':'fa-music','Ukulele':'fa-guitar','Organ':'fa-music',
  };

  bar.innerHTML = `
    <button class="cat-tab active" data-cat="all" onclick="filterByCat('all',this)">
      <i class="fa-solid fa-th"></i> Tất cả
    </button>
    ${cats.map(c => `
      <button class="cat-tab" data-cat="${c}" onclick="filterByCat('${c}',this)">
        <i class="fa-solid ${catIcons[c]||'fa-music'}"></i> ${c}
      </button>`).join('')}`;
}

function filterByCat(cat, btn) {
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // Sync với filter select nếu có
  const catSel = document.getElementById('catFilter');
  if (catSel) catSel.value = cat === 'all' ? '' : cat;

  applyProductFilters();
}

/* ── SEARCH + SORT + FILTER ──────────────────────────────────── */
function initProductSearch() {
  document.getElementById('searchInput')  ?.addEventListener('input',  applyProductFilters);
  document.getElementById('sortSelect')   ?.addEventListener('change', applyProductFilters);
  document.getElementById('catFilter')    ?.addEventListener('change', applyProductFilters);
}

function applyProductFilters() {
  const search  = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const sortVal = document.getElementById('sortSelect')?.value || 'default';
  const catSel  = document.getElementById('catFilter')?.value
               || document.querySelector('.cat-tab.active')?.dataset.cat
               || 'all';

  filteredProducts = allProducts.filter(p => {
    const matchCat  = catSel === 'all' || catSel === '' || p.cat === catSel;
    const matchSrch = !search ||
      p.name.toLowerCase().includes(search) ||
      p.brand.toLowerCase().includes(search) ||
      p.description.toLowerCase().includes(search);
    return matchCat && matchSrch;
  });

  if (sortVal === 'price-asc')  filteredProducts.sort((a,b) => a.price - b.price);
  if (sortVal === 'price-desc') filteredProducts.sort((a,b) => b.price - a.price);
  if (sortVal === 'rating')     filteredProducts.sort((a,b) => b.rating - a.rating);
  if (sortVal === 'newest')     filteredProducts.sort((a,b) => b.id - a.id);

  renderProductGrid(filteredProducts);
}

/* ── THÊM VÀO GIỎ TỪ GRID ───────────────────────────────────── */
function addProductToCart(id) {
  const numId = Number(id);
  const existing = cart.find(x => x.id === numId);
  if (existing) { existing.qty++; }
  else          { cart.push({ id: numId, qty: 1 }); }
  saveCart();
  if (typeof updateCartUI === 'function') updateCartUI();

  // Badge animation
  const btn = document.querySelector(`.pg-card[data-id="${numId}"] .pg-btn-add`);
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    btn.style.background = '#27ae60';
    setTimeout(() => {
      btn.innerHTML = '<i class="fa-solid fa-cart-plus"></i>';
      btn.style.background = '';
    }, 1200);
  }
  showToast('Đã thêm vào giỏ hàng! 🛒', 'ok');
}

/* ── DETAIL MODAL ────────────────────────────────────────────── */
function ensureDetailModal() {
  if (document.getElementById('pgDetailModal')) return;
  const m = document.createElement('div');
  m.id = 'pgDetailModal';
  m.innerHTML = '<div class="pgd-inner"><div class="pgd-content"></div></div>';
  m.addEventListener('click', e => { if (e.target === m) closeProductDetail(); });
  document.body.appendChild(m);
}

function openProductDetail(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;

  const discount = p.orig > p.price && p.orig > 0
    ? Math.round((1 - p.price / p.orig) * 100) : 0;

  let specsHtml = '';
  if (p.specs && typeof p.specs === 'object') {
    const rows = Object.entries(p.specs)
      .filter(([,v]) => v && String(v).toLowerCase() !== 'none')
      .map(([k,v]) => `<tr><td class="sp-key">${k}</td><td>${v}</td></tr>`)
      .join('');
    if (rows) specsHtml = `
      <div class="pgd-specs">
        <h4><i class="fa-solid fa-list-check"></i> Thông số kỹ thuật</h4>
        <table>${rows}</table>
      </div>`;
  }

  const content = document.querySelector('#pgDetailModal .pgd-content');
  if (!content) return;

  content.innerHTML = `
    <button class="pgd-close" onclick="closeProductDetail()">
      <i class="fa-solid fa-xmark"></i>
    </button>

    <div class="pgd-layout">
      <!-- Ảnh to bên trái -->
      <div class="pgd-img-col">
        <div class="pgd-img-box">
          ${p.img
            ? `<img src="${p.img}" alt="${p.name}"
                    onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''
          }
          <div class="pgd-img-ph" style="${p.img ? 'display:none' : ''}">
            <i class="fa-solid fa-guitar"></i>
          </div>
        </div>
      </div>

      <!-- Thông tin bên phải -->
      <div class="pgd-info-col">
        <div class="pgd-tags">
          ${p.cat   ? `<span class="pgd-cat">${p.cat}</span>`   : ''}
          ${p.brand ? `<span class="pgd-brand">${p.brand}</span>` : ''}
        </div>

        <h2 class="pgd-name">${p.name}</h2>

        <div class="pgd-rating">
          ${p.rating > 0
            ? `${renderStars(p.rating)}
               <span>${p.rating.toFixed(1)}/5</span>
               ${p.reviews > 0 ? `<span class="pgd-rev-cnt">${p.reviews} đánh giá</span>` : ''}`
            : '<span class="pg-no-rating">Chưa có đánh giá</span>'
          }
        </div>

        <div class="pgd-price-block">
          <span class="pgd-price">${fmt(p.price)}</span>
          ${p.orig > p.price ? `
            <span class="pgd-orig">${fmt(p.orig)}</span>
            <span class="pgd-pct">-${discount}%</span>` : ''
          }
        </div>

        ${p.description ? `<p class="pgd-desc">${p.description}</p>` : ''}

        ${specsHtml}

        <div class="pgd-btns">
          <button class="pgd-btn-add" onclick="addProductToCart(${p.id});closeProductDetail()">
            <i class="fa-solid fa-cart-plus"></i> Thêm vào giỏ hàng
          </button>
        </div>
      </div>
    </div>`;

  document.getElementById('pgDetailModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProductDetail() {
  document.getElementById('pgDetailModal')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ── CSS ─────────────────────────────────────────────────────── */
function injectProductGridStyles() {
  if (document.getElementById('pgCSS')) return;
  const s = document.createElement('style');
  s.id = 'pgCSS';
  s.textContent = `
    /* ── Grid ── */
    #productGrid{
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(220px,1fr));
      gap:20px;padding:16px 0;
    }
    /* ── Card ── */
    .pg-card{
      background:#fff;border-radius:16px;
      box-shadow:0 2px 12px rgba(0,0,0,.08);
      overflow:hidden;
      display:flex;flex-direction:column;
      transition:transform .2s,box-shadow .2s;
    }
    .pg-card:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(0,0,0,.14)}
    /* 1. Ảnh */
    .pg-img-wrap{
      position:relative;padding-top:65%;
      overflow:hidden;cursor:pointer;background:#f8f3ee;
    }
    .pg-img-wrap img{
      position:absolute;inset:0;width:100%;height:100%;
      object-fit:cover;transition:transform .3s;
    }
    .pg-card:hover .pg-img-wrap img{transform:scale(1.06)}
    .pg-img-ph{
      position:absolute;inset:0;
      display:flex;align-items:center;justify-content:center;
      font-size:52px;color:#d4b896;
    }
    .pg-badge{
      position:absolute;top:8px;left:8px;
      background:#7a5230;color:#fff;
      font-size:11px;font-weight:700;
      padding:3px 9px;border-radius:20px;
    }
    .pg-disc{
      position:absolute;top:8px;right:8px;
      background:#e74c3c;color:#fff;
      font-size:11px;font-weight:700;
      padding:3px 8px;border-radius:20px;
    }
    /* Body */
    .pg-body{padding:13px 14px 15px;display:flex;flex-direction:column;gap:7px;flex:1}
    /* 2. Tên */
    .pg-name{
      font-size:14px;font-weight:700;color:#2c1a0e;
      cursor:pointer;line-height:1.4;
      display:-webkit-box;-webkit-line-clamp:2;
      -webkit-box-orient:vertical;overflow:hidden;
      margin:0;
    }
    .pg-name:hover{color:#7a5230}
    /* 3. Đánh giá */
    .pg-rating{display:flex;align-items:center;gap:4px;font-size:12px}
    .prod-stars .fa-star,.prod-stars .fa-star-half-stroke{color:#f59e0b}
    .prod-stars .fa-regular{color:#e0d0c0}
    .pg-rating-num{font-weight:700;color:#b45309;font-size:12px}
    .pg-reviews{color:#aaa;font-size:11px}
    .pg-no-rating{color:#ccc;font-size:12px}
    /* 4. Giá */
    .pg-price-row{display:flex;align-items:baseline;gap:7px;margin-top:2px}
    .pg-price{font-size:16px;font-weight:800;color:#7a5230}
    .pg-orig{font-size:12px;color:#aaa;text-decoration:line-through}
    /* Nút */
    .pg-actions{display:flex;gap:7px;margin-top:auto;padding-top:4px}
    .pg-btn-detail{
      flex:1;padding:8px;border-radius:8px;
      background:#f5ede4;color:#7a5230;
      border:1.5px solid #e8d5bc;
      font-size:12.5px;font-weight:600;cursor:pointer;
      transition:background .15s;
    }
    .pg-btn-detail:hover{background:#e8d5bc}
    .pg-btn-add{
      padding:8px 13px;border-radius:8px;
      background:#7a5230;color:#fff;
      border:none;font-size:14px;cursor:pointer;
      transition:opacity .15s,background .3s;
    }
    .pg-btn-add:hover{opacity:.85}
    /* Category tabs */
    #categoryBar{display:flex;flex-wrap:wrap;gap:7px;padding:8px 0 14px}
    .cat-tab{
      padding:6px 16px;border-radius:20px;
      border:1.5px solid #e8d5bc;
      background:#fff;color:#7a5230;
      font-size:13px;font-weight:600;cursor:pointer;
      transition:all .15s;
    }
    .cat-tab:hover{background:#f5ede4}
    .cat-tab.active{background:#7a5230;color:#fff;border-color:#7a5230}
    .cat-tab i{margin-right:4px}
    /* Empty */
    .pg-empty{
      grid-column:1/-1;text-align:center;
      padding:60px 20px;color:#aaa;
    }
    .pg-empty i{font-size:40px;display:block;margin-bottom:12px;color:#ddd}

    /* ── Stars ── */
    .prod-stars{display:inline-flex;gap:1px}
    .prod-stars i{font-size:12px}

    /* ── Detail Modal ── */
    #pgDetailModal{
      position:fixed;inset:0;z-index:9990;
      background:rgba(0,0,0,.6);
      display:flex;align-items:center;justify-content:center;
      padding:16px;
      opacity:0;pointer-events:none;
      transition:opacity .2s;
    }
    #pgDetailModal.open{opacity:1;pointer-events:auto}
    .pgd-inner{
      width:100%;max-width:880px;max-height:92vh;
      overflow-y:auto;border-radius:20px;
      background:#fff;
      box-shadow:0 20px 60px rgba(0,0,0,.3);
      transform:translateY(24px);
      transition:transform .22s;
      position:relative;
    }
    #pgDetailModal.open .pgd-inner{transform:translateY(0)}
    .pgd-content{padding:28px}
    .pgd-close{
      position:absolute;top:16px;right:16px;
      width:36px;height:36px;border-radius:50%;
      background:#f0e8dc;border:none;
      font-size:15px;color:#7a5230;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      transition:background .15s;z-index:1;
    }
    .pgd-close:hover{background:#e0d0c0}
    .pgd-layout{
      display:flex;flex-wrap:wrap;gap:28px;
    }
    /* Ảnh to */
    .pgd-img-col{
      flex:0 0 100%;
    }
    @media(min-width:600px){.pgd-img-col{flex:0 0 42%;}}
    .pgd-img-box{
      width:100%;padding-top:100%;
      position:relative;border-radius:14px;
      overflow:hidden;background:#f8f3ee;
    }
    .pgd-img-box img{
      position:absolute;inset:0;width:100%;height:100%;
      object-fit:contain;   /* ← hiện toàn bộ ảnh, không crop */
      padding:12px;
      transition:transform .3s;
    }
    .pgd-img-box img:hover{transform:scale(1.04)}
    .pgd-img-ph{
      position:absolute;inset:0;display:flex;
      align-items:center;justify-content:center;
      font-size:80px;color:#d4b896;
    }
    /* Info */
    .pgd-info-col{flex:1;min-width:0;padding-top:4px}
    .pgd-tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
    .pgd-cat{
      background:#f5ede4;color:#7a5230;
      font-size:11px;font-weight:700;
      padding:3px 10px;border-radius:20px;
    }
    .pgd-brand{
      background:#f0f0f0;color:#555;
      font-size:11px;font-weight:700;
      padding:3px 10px;border-radius:20px;
    }
    .pgd-name{
      font-size:20px;font-weight:800;
      color:#2c1a0e;margin:0 0 10px;
      line-height:1.35;
    }
    .pgd-rating{display:flex;align-items:center;gap:7px;font-size:13px;margin-bottom:12px}
    .pgd-rev-cnt{color:#aaa}
    .pgd-price-block{
      display:flex;align-items:baseline;
      gap:10px;margin-bottom:14px;
    }
    .pgd-price{font-size:26px;font-weight:900;color:#7a5230}
    .pgd-orig{font-size:14px;color:#aaa;text-decoration:line-through}
    .pgd-pct{
      background:#e74c3c;color:#fff;
      font-size:12px;font-weight:700;
      padding:2px 8px;border-radius:20px;
    }
    .pgd-desc{
      font-size:14px;color:#555;line-height:1.7;
      margin-bottom:14px;
      max-height:130px;overflow-y:auto;
    }
    .pgd-specs{margin-bottom:16px}
    .pgd-specs h4{
      font-size:13px;font-weight:700;
      color:#7a5230;margin-bottom:8px;
    }
    .pgd-specs table{width:100%;border-collapse:collapse;font-size:13px}
    .pgd-specs td{
      padding:5px 8px;
      border-bottom:1px solid #f0ebe3;color:#555;
    }
    .sp-key{font-weight:600;color:#333;width:44%}
    .pgd-btns{margin-top:18px}
    .pgd-btn-add{
      width:100%;padding:13px 20px;
      border-radius:10px;border:none;
      background:#7a5230;color:#fff;
      font-size:15px;font-weight:700;
      cursor:pointer;transition:opacity .15s;
    }
    .pgd-btn-add:hover{opacity:.88}
    @media(max-width:599px){
      .pgd-content{padding:18px}
      .pgd-name{font-size:17px}
      .pgd-price{font-size:20px}
    }
  `;
  document.head.appendChild(s);
}