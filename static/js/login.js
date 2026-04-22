/* ================================================================
   STRUMIFY – login.js
   Data Flow:
     Đăng ký → POST /auth/register
     Đăng nhập → POST /auth/login → Lưu access_token vào localStorage
     Remember Me → Token tồn tại đến khi hết hạn (7 ngày)
     Quên mật khẩu → POST /auth/forgot-password → Gửi email reset
     Đặt lại MK → POST /auth/reset-password
   ================================================================ */

/* ── TAB SWITCH ────────────────────────────── */
function switchTab(tab) {
  ['login', 'register'].forEach(t => {
    const cap = t.charAt(0).toUpperCase() + t.slice(1);
    document.getElementById('panel' + cap)?.classList.toggle('active', t === tab);
    document.getElementById('tab'   + cap)?.classList.toggle('active', t === tab);
  });
  clearMsg();
}

/* ── MESSAGES ──────────────────────────────── */
function showMsg(text, type = 'error') {
  const el = document.getElementById('globalMsg');
  if (!el) return;
  el.textContent = text;
  el.className = 'msg show ' + (type === 'success' ? 'success' : 'error');
  if (type === 'error') setTimeout(clearMsg, 6000);
}
function clearMsg() {
  const el = document.getElementById('globalMsg');
  if (el) { el.className = 'msg'; el.textContent = ''; }
}

/* ── TOGGLE PASSWORD ───────────────────────── */
function togglePw(id, btn) {
  const inp = document.getElementById(id);
  const ico = btn.querySelector('i');
  if (!inp || !ico) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  ico.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
}

/* ── STRENGTH ──────────────────────────────── */
function checkStrength(pw) {
  const fill  = document.getElementById('strengthFill');
  const label = document.getElementById('strengthLabel');
  if (!fill || !label) return;
  let s = 0;
  if (pw.length >= 6)          s++;
  if (pw.length >= 10)         s++;
  if (/[A-Z]/.test(pw))        s++;
  if (/[0-9]/.test(pw))        s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const lvls = [
    { w: '0%',   c: 'transparent', t: '' },
    { w: '25%',  c: '#c0392b',     t: 'Yếu' },
    { w: '50%',  c: '#d68910',     t: 'Trung bình' },
    { w: '75%',  c: '#8c6248',     t: 'Khá mạnh' },
    { w: '100%', c: '#3d8b5e',     t: 'Mạnh' },
  ];
  const l = lvls[Math.min(s, 4)];
  fill.style.width      = l.w;
  fill.style.background = l.c;
  label.textContent     = l.t;
  label.style.color     = l.c;
}

/* ================================================================
   DATA FLOW – TOKEN HELPERS
   Lưu vào localStorage → tồn tại qua reload & đóng tab
   ================================================================ */
const Auth = {
  /** Lưu token + thông tin user vào localStorage */
  save(data) {
    if (data.access_token) localStorage.setItem('access_token', data.access_token);
    if (data.user) {
      const u = data.user;
      localStorage.setItem('user_id',      String(u.id)            || '');
      localStorage.setItem('user_name',    u.username              || '');
      localStorage.setItem('user_email',   u.email                 || '');
      localStorage.setItem('user_phone',   u.phone                 || '');
      localStorage.setItem('user_address', u.address               || '');
      localStorage.setItem('user_role',    u.role                  || 'customer');
      localStorage.setItem('user_tier',    u.membership_tier       || 'new');
      localStorage.setItem('user_avatar',  u.avatar_url            || '');
    }
    /* Đảm bảo role từ top-level nếu có */
    if (data.role) localStorage.setItem('user_role', data.role);
  },

  /** Xóa toàn bộ session */
  clear() {
    ['access_token','user_id','user_name','user_email',
     'user_phone','user_address','user_role','user_tier','user_avatar']
      .forEach(k => localStorage.removeItem(k));
  },

  token()   { return localStorage.getItem('access_token') || ''; },
  role()    { return localStorage.getItem('user_role')    || ''; },
  isAdmin() { return this.role() === 'admin'; },
};

/* ================================================================
   ĐĂNG NHẬP
   ================================================================ */
async function handleLogin(event) {
  event.preventDefault();
  const email    = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;
  const btn      = event.submitter || document.querySelector('#panelLogin .btn-primary');

  if (!email || !password) { showMsg('Vui lòng nhập email và mật khẩu.'); return; }

  setBtn(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng nhập…');

  try {
    const res  = await fetch('/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (res.ok) {
      /* Data Flow: Lưu token vào localStorage (Remember Me tự động) */
      Auth.save(data);
      showMsg('Đăng nhập thành công! Đang chuyển hướng…', 'success');

      const next = new URLSearchParams(window.location.search).get('next');
      const url  = Auth.isAdmin() ? '/admin' : (next || '/');
      setTimeout(() => { window.location.href = url; }, 900);
    } else {
      showMsg(data.detail || data.message || 'Sai tài khoản hoặc mật khẩu.');
    }
  } catch {
    showMsg('Không thể kết nối đến máy chủ. Kiểm tra lại mạng!');
  } finally {
    setBtn(btn, false, '<i class="fa-solid fa-right-to-bracket"></i> Đăng nhập');
  }
}

/* ================================================================
   ĐĂNG KÝ
   ================================================================ */
async function handleRegister(event) {
  event.preventDefault();
  ['errName','errEmail','errPhone','errDob','errConfirm'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '';
  });

  const fields = {
    username: document.getElementById('regName')?.value.trim()    || '',
    email:    document.getElementById('regEmail')?.value.trim()   || '',
    phone:    document.getElementById('regPhone')?.value.trim()   || '',
    dob:      document.getElementById('regDob')?.value            || '',
    gender:   document.getElementById('regGender')?.value         || '',
    address:  document.getElementById('regAddress')?.value.trim() || '',
    password: document.getElementById('regPassword')?.value       || '',
    confirm:  document.getElementById('regConfirm')?.value        || '',
  };

  const btn = event.submitter || document.querySelector('#panelRegister .btn-primary');

  /* Validate client-side */
  if (fields.username.length < 2)    { document.getElementById('errName').textContent   = 'Họ tên ≥ 2 ký tự.'; return; }
  if (!fields.dob)                   { document.getElementById('errDob').textContent    = 'Chọn ngày sinh.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) { document.getElementById('errEmail').textContent = 'Email không đúng định dạng.'; return; }
  if (!/^(0[1-9]{1}[0-9]{8}|\+84[1-9]{1}[0-9]{8})$/.test(fields.phone)) {
    document.getElementById('errPhone').textContent = 'SĐT không hợp lệ (VD: 0912345678)';
    return;
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}/.test(fields.password)) {
    showMsg('Mật khẩu cần ≥ 8 ký tự, có chữ hoa, thường, số và ký tự đặc biệt!'); return;
  }
  if (fields.password !== fields.confirm) { document.getElementById('errConfirm').textContent = 'Mật khẩu xác nhận không khớp!'; return; }

  setBtn(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng ký…');

  try {
    const res = await fetch('/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        username: fields.username,
        email:    fields.email,
        phone:    fields.phone,
        dob:      fields.dob,
        gender:   fields.gender,
        address:  fields.address,
        password: fields.password,
        role:     'customer',  /* Luôn là customer */
      }),
    });
    const data = await res.json();

    if (res.ok || res.status === 201) {
      showMsg('Đăng ký thành công! Chuyển sang đăng nhập…', 'success');
      setTimeout(() => {
        switchTab('login');
        const emailEl = document.getElementById('loginEmail');
        if (emailEl) emailEl.value = fields.email;
      }, 1500);
    } else {
      showMsg(data.detail || data.message || 'Đăng ký thất bại.');
    }
  } catch {
    showMsg('Không thể kết nối đến máy chủ. Kiểm tra lại mạng!');
  } finally {
    setBtn(btn, false, '<i class="fa-solid fa-user-plus"></i> Tạo tài khoản');
  }
}

/* ================================================================
   QUÊN MẬT KHẨU  →  Supabase / API gửi link/OTP về email
   ================================================================ */
function showForgot() {
  showForgotStep1();
  document.getElementById('forgotOverlay').classList.add('open');
}
function hideForgot() { document.getElementById('forgotOverlay').classList.remove('open'); }
function showForgotStep1() {
  document.getElementById('forgotStep1').style.display = '';
  document.getElementById('forgotStep2').style.display = 'none';
  const el  = document.getElementById('forgotEmail'); if (el) el.value = '';
  const err = document.getElementById('errForgot');   if (err) err.textContent = '';
}

async function sendResetEmail() {
  const emailEl = document.getElementById('forgotEmail');
  const errEl   = document.getElementById('errForgot');
  const btn     = document.getElementById('btnSendReset');
  const email   = emailEl?.value.trim() || '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (errEl) errEl.textContent = 'Email không đúng định dạng.'; return;
  }
  if (errEl) errEl.textContent = '';

  setBtn(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi…');
  try {
    const res  = await fetch('/auth/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    });
    /* Luôn hiện "đã gửi" (tránh lộ email tồn tại) */
    document.getElementById('sentToEmail').textContent = email;
    document.getElementById('forgotStep1').style.display = 'none';
    document.getElementById('forgotStep2').style.display = '';
    if (!res.ok) {
      const data = await res.json();
      if (errEl) errEl.textContent = data.detail || 'Gửi email thất bại.';
    }
  } catch {
    if (errEl) errEl.textContent = 'Không thể kết nối máy chủ.';
  } finally {
    setBtn(btn, false, '<i class="fa-solid fa-paper-plane"></i> Gửi email đặt lại');
  }
}

/* ================================================================
   ĐẶT LẠI MẬT KHẨU
   ================================================================ */
async function submitReset() {
  const newPw = document.getElementById('newPassword')?.value        || '';
  const cfm   = document.getElementById('newPasswordConfirm')?.value || '';
  const errEl = document.getElementById('errReset');
  const btn   = document.getElementById('btnSubmitReset');

  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}/.test(newPw)) {
    if (errEl) errEl.textContent = 'Mật khẩu cần ≥8 ký tự, chữ hoa, thường, số, ký tự đặc biệt.'; return;
  }
  if (newPw !== cfm) { if (errEl) errEl.textContent = 'Mật khẩu xác nhận không khớp!'; return; }
  if (errEl) errEl.textContent = '';

  const token = new URLSearchParams(window.location.search).get('reset_token') || '';
  setBtn(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu…');

  try {
    const res  = await fetch('/auth/reset-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, new_password: newPw }),
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('resetOverlay')?.classList.remove('open');
      showMsg('Đặt lại mật khẩu thành công! Vui lòng đăng nhập.', 'success');
    } else {
      if (errEl) errEl.textContent = data.detail || 'Đặt lại thất bại.';
    }
  } catch {
    if (errEl) errEl.textContent = 'Không thể kết nối máy chủ.';
  } finally {
    setBtn(btn, false, '<i class="fa-solid fa-floppy-disk"></i> Lưu mật khẩu mới');
  }
}

/* ── HELPER ────────────────────────────────── */
function setBtn(btn, disabled, html) {
  if (!btn) return;
  btn.disabled  = disabled;
  btn.innerHTML = html;
}

/* ── FLOATING ICONS ───────────────────────── */
const ICONS = [
  { icon: 'fa-guitar',           color: '#b35d1e', size: 28 },
  { icon: 'fa-guitar',           color: '#8c4a18', size: 22 },
  { icon: 'fa-guitar',           color: '#c97840', size: 36 },
  { icon: 'fa-drum',             color: '#a62626', size: 26 },
  { icon: 'fa-drum',             color: '#c0392b', size: 20 },
  { icon: 'fa-microphone-lines', color: '#546e7a', size: 22 },
  { icon: 'fa-music',            color: '#3d8b5e', size: 20 },
  { icon: 'fa-music',            color: '#4caf82', size: 18 },
  { icon: 'fa-headphones',       color: '#5c6bc0', size: 22 },
  { icon: 'fa-compact-disc',     color: '#8e5490', size: 20 },
  { icon: 'fa-record-vinyl',     color: '#455a64', size: 26 },
];
const POOL = 20;
let instrCanvas;
function rnd(a, b) { return Math.random() * (b - a) + a; }

function spawnIcon() {
  if (!instrCanvas) return;
  const d = ICONS[Math.floor(Math.random() * ICONS.length)];
  const s = document.createElement('span');
  s.className = 'float-icon fa-solid ' + d.icon;
  s.style.cssText = `left:${rnd(3,94)}%;bottom:-80px;font-size:${d.size}px;color:${d.color};
    --r0:${rnd(-25,25)}deg;--r1:${rnd(-25,25)}deg;--op:${rnd(.5,.8)};
    animation-duration:${rnd(9,18)}s;animation-delay:${rnd(0,5)}s;`;
  s.addEventListener('click', () => { s.classList.add('burst'); setTimeout(() => s.classList.remove('burst'), 600); });
  s.addEventListener('animationend', () => s.remove());
  instrCanvas.appendChild(s);
}

/* ── INIT ──────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  instrCanvas = document.getElementById('instrument-canvas');
  for (let i = 0; i < POOL; i++) spawnIcon();
  setInterval(() => { if (instrCanvas?.children.length < POOL) spawnIcon(); }, 800);

  /* Nếu URL có reset_token → mở modal đặt lại mật khẩu */
  if (new URLSearchParams(window.location.search).get('reset_token')) {
    document.getElementById('resetOverlay')?.classList.add('open');
  }

  document.getElementById('forgotOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'forgotOverlay') hideForgot();
  });
});