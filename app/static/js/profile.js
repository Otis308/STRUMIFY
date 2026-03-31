/* ================================================================
   STRUMIFY – profile.js (Cleaned & Unified Version)
   Tích hợp Supabase Auth + Database và UI/UX mượt mà
   ================================================================ */
'use strict';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import * as cartSync from './cart.js';

// --- CONFIG SUPABASE ---
const SUPABASE_URL = 'https://wpbmixpiydtbrgcentrt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rcJGMgPHxCdESXDotpweuw_Oew_sz4R'; // Tạm ẩn key thực tế để an toàn nếu cần
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- CONSTANTS & CONFIGS ---
const API = ''; // Để trống nếu bạn đã chuyển hoàn toàn sang Supabase SDK
const TIER = {
  new:     { label:'Thành viên Mới',      icon:'fa-seedling', color:'#8a6f55', bg:'#f5ede4', next:'Bạc: 3 đơn hoặc 1 triệu ₫' },
  silver:  { label:'Thành viên Bạc',      icon:'fa-medal',    color:'#64748b', bg:'#f1f5f9', next:'Vàng: 20 đơn hoặc 5 triệu ₫' },
  gold:    { label:'Thành viên Vàng',     icon:'fa-crown',    color:'#b45309', bg:'#fef9ee', next:'Kim Cương: 75 đơn hoặc 15 triệu ₫' },
  diamond: { label:'Thành viên Kim Cương',icon:'fa-gem',      color:'#6d28d9', bg:'#f5f3ff', next:'Bạn đã đạt cấp cao nhất! 🎉' },
};

/* ================================================================
   1. AUTHENTICATION (Đăng nhập, Đăng xuất)
   ================================================================ */

async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('log-email')?.value;
  const password = document.getElementById('log-pass')?.value;
  
  if (!email || !password) { showToast('⚠ Vui lòng điền đủ thông tin!'); return; }
  
  const btn = document.querySelector('.auth-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...'; }
  
  try {
    // 1. Gửi request đăng nhập lên Backend của bạn
    const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
            email: email, 
            password: password 
        })
    });

    // 2. Chuyển kết quả trả về thành dạng JSON
    const data = await response.json();

    // 3. Kiểm tra xem đăng nhập có thành công không
    if (!response.ok) {
        // Nếu API báo lỗi (VD: sai mật khẩu, tài khoản không tồn tại)
        console.error("Lỗi từ server:", data.detail || "Đăng nhập thất bại");
        alert("Đăng nhập thất bại: " + (data.detail || "Vui lòng kiểm tra lại thông tin."));
        return; // Dừng lại, không chạy tiếp
    }

    // 4. Nếu thành công -> Lưu Token vào trình duyệt
    // Giả sử API của bạn trả về { "access_token": "chuỗi_token_dài_ngoằng", "token_type": "bearer" }
    localStorage.setItem('access_token', data.access_token);
    
    // (Tùy chọn) Lưu thêm thông tin user nếu backend có trả về
    if (data.user) {
        localStorage.setItem('user_info', JSON.stringify(data.user));
    }

    console.log("Đăng nhập thành công!");
    
    // 5. Cập nhật lại giao diện hoặc chuyển trang
    // Ví dụ: tải lại trang profile hoặc ẩn form đăng nhập
    window.location.reload(); 

} catch (error) {
    console.error("Lỗi kết nối mạng hoặc server:", error);
    alert("Không thể kết nối đến máy chủ.");
}
}

async function handleRegister(e) {
  e.preventDefault();
  // ... Logic đăng ký của bạn ...
}

async function handleLogout() {
  if (!confirm('Bạn có chắc muốn đăng xuất?')) return;
  
  await supabase.auth.signOut();

  localStorage.clear();
  sessionStorage.clear();
  
  showToast('🔑 Đã đăng xuất an toàn!');
  
  setTimeout(() => { window.location.href = '/login'; }, 1000);
}

/* ================================================================
   2. PROFILE MANAGEMENT (Tải & Lưu thông tin user)
   ================================================================ */

async function loadUserProfile() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    if (window.location.pathname.includes('/profile')) {
      window.location.href = '/login?next=' + window.location.pathname; 
    }
    return;
  }
  
  const md = user.user_metadata || {};
  
  // 1. Điền Form Thông Tin
  setVal('fieldName',    md.full_name || md.username || '');
  setVal('fieldEmail',   user.email || '');
  setVal('fieldPhone',   md.phone || '');
  setVal('fieldAddress', md.address || '');
  setVal('fieldDob',     md.dob || '');
  if (document.getElementById('fieldGender') && md.gender) {
    document.getElementById('fieldGender').value = md.gender;
  }
  setText('pro-joined-date', new Date(user.created_at).toLocaleDateString());
  
  // 2. Cập nhật Sidebar & Header
  const name = md.full_name || md.username || user.email?.split('@')[0] || 'Khách';
  setText('sidebarName', name);
  setText('navName', name);
  
  const av = md.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8c5a30&color=f5e4c0&bold=true&size=160`;
  document.querySelectorAll('.avatar-preview').forEach(img => img.src = av);

  // 3. Render Tích điểm (Gắn tạm data, nếu bạn có bảng profile trong DB thì select ra)
  renderMembership({ membership_tier: md.tier, total_spent: md.spent, order_count: md.orders });
  
  // 4. Load lịch sử mua hàng chuẩn xác
  await loadOrderHistory(user);
}

async function saveProfile() {
  const btn   = document.getElementById('btnSave');
  const toast = document.getElementById('saveToast');
  if (!btn) return;

  btn.disabled  = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu…';

  try {
    const updates = {
      full_name: document.getElementById('fieldName')?.value.trim(),
      phone:     document.getElementById('fieldPhone')?.value.trim(),
      address:   document.getElementById('fieldAddress')?.value.trim(),
      dob:       document.getElementById('fieldDob')?.value,
      gender:    document.getElementById('fieldGender')?.value
    };

    // Cập nhật vào Supabase Auth Metadata
    const { error } = await supabase.auth.updateUser({ data: updates });

    if (!error) {
      if (updates.full_name) { setText('sidebarName', updates.full_name); setText('navName', updates.full_name); }
      if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
    } else {
      alert('Lưu thất bại: ' + error.message);
    }
  } catch (e) { 
    alert('Không thể kết nối máy chủ.'); 
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu thay đổi';
  }
}

/* ================================================================
   3. ORDER HISTORY (Tải đơn hàng từ Supabase + Render UI đẹp)
   ================================================================ */

async function loadOrderHistory(user) {
  const list = document.querySelector('.order-list') || document.getElementById('orderHistoryContainer');
  if (!list) return;
  
  list.innerHTML = '<div style="text-align:center;padding:40px 0;color:#aaa"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>';
  
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id, order_code, created_at, status, total_final,
        order_items ( id, quantity, price_at_order, 
          products ( id, name, image_url ) )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    if (orders && orders.length > 0) {
      list.innerHTML = ''; // Clear loading
      orders.forEach(o => list.appendChild(renderOrderCard(o)));
    } else {
      list.innerHTML = `
        <div class="orders-empty-msg" style="text-align:center;padding:48px 20px;color:#aaa">
          <i class="fa-solid fa-bag-shopping" style="font-size:36px;color:#ddd;display:block;margin-bottom:10px"></i>
          <p style="font-size:15px">Bạn chưa mua sản phẩm nào.</p>
          <a href="/order" style="display:inline-block;margin-top:12px;padding:9px 22px;background:#7a5230;color:#fff;border-radius:10px;text-decoration:none;font-weight:700">
            Mua sắm ngay
          </a>
        </div>`;
    }
  } catch(err) {
    console.error('Error load orders:', err);
    list.innerHTML = '<div style="text-align:center;padding:40px 0;color:#e74c3c">⚠ Lỗi tải dữ liệu đơn hàng!</div>';
  }
}

function renderOrderCard(o) {
  const SM = {
    pending:    { label:'Chờ xác nhận', cls:'s-processing', icon:'fa-clock' },
    processing: { label:'Đang xử lý',   cls:'s-processing', icon:'fa-box' },
    shipping:   { label:'Đang giao',    cls:'s-shipping',   icon:'fa-truck' },
    delivered:  { label:'Đã nhận',      cls:'s-delivered',  icon:'fa-circle-check' },
    cancelled:  { label:'Đã hủy',       cls:'s-cancelled',  icon:'fa-ban' },
  };

  const st   = SM[o.status] || SM.pending;
  const date = o.created_at ? new Date(o.created_at).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' }) : '';
  
  // Render các sản phẩm bên trong đơn hàng
  const itemsHtml = (o.order_items || []).map(it => {
    const p = it.products || {};
    const imgUrl = p.image_url || '';
    return `
      <div class="order-item" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f0ebe3">
        <div class="item-thumb" style="width:60px;height:60px;border-radius:8px;background:#fcfaf7;display:flex;align-items:center;justify-content:center;overflow:hidden">
          ${imgUrl ? `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;">` : '<i class="fa-solid fa-guitar" style="color:#d4b896"></i>'}
        </div>
        <div style="flex:1">
          <div class="item-name" style="font-weight:600;font-size:14px;color:#333">${p.name || 'Sản phẩm'}</div>
          <div class="item-sub" style="color:#888;font-size:12px;margin-top:4px">SL: ${it.quantity}</div>
        </div>
        <div class="item-price" style="font-weight:700;color:#7a5230">${fmt(it.price_at_order)}</div>
      </div>`;
  }).join('');

  const card = document.createElement('div');
  card.className      = 'order-card';
  card.dataset.status = o.status || 'pending';
  card.innerHTML = `
    <div class="order-head" style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding-bottom:10px;margin-bottom:10px">
      <div>
        <div class="order-id" style="font-weight:700"><i class="fa-solid fa-hashtag"></i> ${o.order_code}</div>
        <div class="order-date" style="font-size:12px;color:#888;margin-top:4px"><i class="fa-regular fa-calendar"></i> ${date}</div>
      </div>
      <span class="status-badge ${st.cls}" style="font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;height:fit-content"><i class="fa-solid ${st.icon}"></i> ${st.label}</span>
    </div>
    <div class="order-body">
      ${itemsHtml}
    </div>
    <div class="order-foot" style="display:flex;justify-content:space-between;align-items:center;margin-top:15px;padding-top:10px">
      <div class="order-total" style="font-size:16px;font-weight:800;color:#e74c3c"><span>Tổng:</span> ${fmt(o.total_final || 0)}</div>
      <button class="btn-track" onclick="openModal('${o.order_code}')" style="padding:8px 16px;background:#7a5230;color:white;border:none;border-radius:6px;cursor:pointer">
        <i class="fa-solid fa-map-location-dot"></i> Theo dõi
      </button>
    </div>`;
  return card;
}

/* ================================================================
   4. GIAO DIỆN & TIỆN ÍCH (UI / UX / HELPERS)
   ================================================================ */

function fmt(n)        { return new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(n||0); }
function setText(id,v) { const el=document.getElementById(id); if(el) el.textContent=v; }
function setVal(id,v)  { const el=document.getElementById(id); if(el) el.value=v||''; }

function showToast(msg) {
  // Hàm hiển thị toast thông báo, bạn cần chắc chắn có DOM element cho toast này
  alert(msg); // Tạm fallback bằng alert nếu chưa làm UI toast
}

function switchSection(id) {
  document.querySelectorAll('.card').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.querySelector(`.sidebar-nav a[data-section="${id}"]`)?.classList.add('active');
}

function initUI() {
  // Tabs
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      switchSection(a.dataset.section);
      window.history.pushState(null, '', '#' + a.dataset.section.replace('sec-', ''));
    });
  });

  // Avatar
  const input = document.getElementById('avatarInput');
  const area  = document.getElementById('avatarUploadArea');
  const apply = f => {
    if (!f?.type.startsWith('image/')) return;
    const r = new FileReader();
    r.onload = e => document.querySelectorAll('.avatar-preview').forEach(img => img.src = e.target.result);
    r.readAsDataURL(f);
  };
  input?.addEventListener('change', () => apply(input.files[0]));
  area?.addEventListener('dragover',  e  => { e.preventDefault(); area.style.borderColor = 'var(--wood-light)'; });
  area?.addEventListener('dragleave', () => { area.style.borderColor = ''; });
  area?.addEventListener('drop',      e  => { e.preventDefault(); area.style.borderColor = ''; apply(e.dataTransfer.files[0]); });
  area?.addEventListener('click',     () => input?.click());

  // Filter Đơn hàng
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      document.querySelectorAll('.order-card').forEach(c => {
        c.style.display = (f === 'all' || c.dataset.status === f) ? 'block' : 'none';
      });
    });
  });

  // Stars & Chips
  const stars = [...document.querySelectorAll('.star')];
  const ratingInput = document.getElementById('ratingValue');
  if (stars.length && ratingInput) {
    stars.forEach((s, i) => {
      s.addEventListener('mouseenter', () => stars.forEach((st, j) => st.classList.toggle('lit', j <= i)));
      s.addEventListener('click', () => { ratingInput.value = i + 1; });
    });
    document.querySelector('.stars')?.addEventListener('mouseleave', () => {
      const v = parseInt(ratingInput.value) || 0;
      stars.forEach((s, i) => s.classList.toggle('lit', i < v));
    });
  }

  document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(x => x.classList.remove('selected'));
    c.classList.add('selected'); setVal('selectedProduct', c.dataset.product);
  }));

  const ta = document.getElementById('feedbackText'), cnt = document.getElementById('charCount');
  ta?.addEventListener('input', () => { if (cnt) cnt.textContent = `${ta.value.length}/500`; });
}

function renderMembership(u) {
  const tier  = u.membership_tier || 'new';
  const info  = TIER[tier] || TIER.new;
  const spent = u.total_spent  || 0;
  const orders = u.order_count  || 0;
  
  // Logic render membership UI (Giữ nguyên của bạn)
  const badge = document.getElementById('memberBadge');
  if (badge) {
    badge.innerHTML        = `<i class="fa-solid ${info.icon}" style="color:${info.color}"></i> <span>${info.label}</span>`;
    badge.style.background = info.bg;
    badge.style.color      = info.color;
    badge.style.border     = `1px solid ${info.color}40`;
  }
}

// Global scope Modal
window.openModal = function(id) { setText('tlOrderId', id); document.getElementById('timelineModal')?.classList.add('open'); document.body.style.overflow = 'hidden'; }
window.closeProfileModal = function()  { document.getElementById('timelineModal')?.classList.remove('open'); document.body.style.overflow = ''; }
window.saveProfile = saveProfile;
window.logout = handleLogout;
/* ================================================================
   5. BOOTSTRAP (Chạy khi tải trang)
   ================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  // Lấy section từ URL hash (nếu có), ví dụ: profile#orders
  const hash = window.location.hash.replace('#', '');
  const startSection = hash ? `sec-${hash}` : 'sec-info';
  switchSection(startSection);

  initUI();
  
  // Kiểm tra đăng nhập và nạp dữ liệu Profile/Orders
  await loadUserProfile();
});

// Xuất các hàm auth nếu form HTML của bạn cần gọi trực tiếp
export { supabase, handleRegister, handleLogin, handleLogout };