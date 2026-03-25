/* ================================================================
   base.js  –  Strumify  (Fixed + Auth Nav)
   ================================================================ */

/* ── FIX ẢNH BỊ 404 ─────────────────────────────────────────────*/
document.addEventListener('error', function(e) {
  const el = e.target;
  if (el.tagName !== 'IMG') return;
  if (el.dataset.errHandled) return;
  el.dataset.errHandled = 'true';
  el.style.display = 'none';
  const next = el.nextElementSibling;
  if (next && (next.classList.contains('img-placeholder') ||
               next.classList.contains('item-thumb-placeholder'))) {
    next.style.display = 'flex';
  }
}, true);

/* ── AUTH STATE MANAGEMENT ───────────────────────────────────────*/
function getToken()   { return localStorage.getItem('access_token') || ''; }
function getUserRole(){ return localStorage.getItem('user_role') || ''; }
function getUserName(){ return localStorage.getItem('user_name') || ''; }

function isTokenExpired(token) {
  try {
    const p = JSON.parse(atob(token.split('.')[1]));
    return p.exp * 1000 < Date.now();
  } catch { return true; }
}

function updateNavAuth() {
  const token    = getToken();
  const loggedIn = token && !isTokenExpired(token);
  const role     = getUserRole();
  const name     = getUserName();

  /* Hiện/ẩn nút dựa trên trạng thái đăng nhập */
  const btnProfile  = document.getElementById('btnProfile');
  const btnLogin    = document.getElementById('btnLogin');
  const btnLogout   = document.getElementById('btnLogout');
  const btnAdmin    = document.getElementById('btnAdmin');
  const welcomeText = document.getElementById('navWelcome');

  if (loggedIn) {
    if (btnProfile) { btnProfile.style.display = 'flex'; btnProfile.title = name || 'Profile'; }
    if (btnLogin)   btnLogin.style.display   = 'none';
    if (btnLogout)  btnLogout.style.display  = 'flex';
    if (btnAdmin)   btnAdmin.style.display   = role === 'admin' ? 'flex' : 'none';
    if (welcomeText){ welcomeText.textContent = `Xin chào, ${name}`; welcomeText.style.display = 'block'; }
  } else {
    if (btnProfile)  btnProfile.style.display  = 'none';
    if (btnLogin)    btnLogin.style.display     = 'flex';
    if (btnLogout)   btnLogout.style.display    = 'none';
    if (btnAdmin)    btnAdmin.style.display     = 'none';
    if (welcomeText) welcomeText.style.display  = 'none';
    /* Xóa token hết hạn */
    if (token) localStorage.removeItem('access_token');
  }
}

/* ── ĐĂNG XUẤT ───────────────────────────────────────────────────*/
function logoutUser() {
  if (!confirm('Bạn có chắc muốn đăng xuất?')) return;
  [
    'access_token','user_id','user_name','user_email',
    'user_phone','user_address','user_role','user_tier',
    'user_avatar','user_dob','user_gender',
  ].forEach(k => localStorage.removeItem(k));
  window.location.href = '/';
}

/* ── CART BADGE ──────────────────────────────────────────────────*/
function updateCartBadge() {
  try {
    const cart     = JSON.parse(localStorage.getItem('strumify_cart') || '[]');
    const totalQty = cart.reduce((s, x) => s + (x.qty || 0), 0);
    document.querySelectorAll('.cart-badge, .cart-count').forEach(el => {
      el.textContent    = totalQty;
      el.style.display  = totalQty > 0 ? '' : 'none';
    });
  } catch {}
}

/* ── SEARCH TOGGLE ───────────────────────────────────────────────*/
function initSearch() {
  const btn     = document.getElementById('mocBtnSearch');
  const wrapper = document.getElementById('mocWrapperSearch');
  const input   = document.getElementById('mocInputSearch');
  if (!btn || !wrapper) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    wrapper.classList.toggle('active');
    if (wrapper.classList.contains('active')) input?.focus();
  });
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target) && e.target !== btn) {
      wrapper.classList.remove('active');
    }
  });
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      window.location.href = `/order?search=${encodeURIComponent(input.value.trim())}`;
    }
  });
}

/* ── MOBILE MENU ─────────────────────────────────────────────────*/
function initMobileMenu() {
  const btn   = document.getElementById('mobileMenuBtn');
  const links = document.getElementById('navLinks');
  if (!btn || !links) return;
  btn.addEventListener('click', () => links.classList.toggle('active'));
  document.addEventListener('click', (e) => {
    if (!links.contains(e.target) && e.target !== btn) {
      links.classList.remove('active');
    }
  });
}

/* ── INIT ────────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', () => {
  updateNavAuth();
  updateCartBadge();
  initSearch();
  initMobileMenu();
});

window.addEventListener('storage', (e) => {
  if (e.key === 'strumify_cart') updateCartBadge();
  if (e.key === 'access_token')  updateNavAuth();
});