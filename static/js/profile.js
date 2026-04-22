/* ════════════════════════════════════════════════════════════════════════════
   profile_v2.js – Load Order History từ API
   Thay thế profile.js cũ
   ════════════════════════════════════════════════════════════════════════════ */

'use strict';

const API_BASE = 'http://127.0.0.1:8000';

/* ── AUTH ────────────────────────────────────────────────────────────────── */
function getToken() { return localStorage.getItem('access_token') || ''; }

function getHeaders() {
  return { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}

/* ── FORMAT ──────────────────────────────────────────────────────────────── */
function formatPrice(n) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(n || 0);
}

function formatDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString('vi-VN');
}

function formatStatus(status) {
  const statusMap = {
    'processing': { text: 'Đang xử lý', class: 's-processing', icon: 'fa-clock' },
    'confirmed': { text: 'Đã xác nhận', class: 's-confirmed', icon: 'fa-check-circle' },
    'shipping': { text: 'Đang giao', class: 's-shipping', icon: 'fa-truck' },
    'delivered': { text: 'Đã nhận', class: 's-delivered', icon: 'fa-check' },
    'cancelled': { text: 'Hủy', class: 's-cancelled', icon: 'fa-xmark-circle' },
  };
  return statusMap[status] || { text: status, class: '', icon: 'fa-circle' };
}

/* ════════════════════════════════════════════════════════════════════════════
   LOAD USERS INFO
   ════════════════════════════════════════════════════════════════════════════ */
async function loadUserInfo() {
  if (!getToken()) return; // Nếu chưa đăng nhập thì thôi
  
  try {
    const res = await fetch(`${API_BASE}/profile/me`, { headers: getHeaders() });
    if (!res.ok) return;
    const payload = await res.json();
    const user = payload?.user || payload || {};

    // 1. Cập nhật Tên và Email ở Sidebar & TopNav
    const displayName = user.full_name || user.username || 'Khách hàng MỘC';
    document.querySelectorAll('.sidebar-name, .topnav-name').forEach(el => el.textContent = displayName);
    document.querySelectorAll('.sidebar-nickname').forEach(el => el.textContent = user.email || '');

    // 2. Cập nhật vào Form thông tin cá nhân (Cần có ID ở HTML)
    const inputName = document.getElementById('profileName');
    const inputEmail = document.getElementById('profileEmail');
    if (inputName) inputName.value = displayName || '';
    if (inputEmail) inputEmail.value = user.email || '';

    // Lấy chữ cái đầu làm Avatar
    const avatarInitials = (displayName || 'M').charAt(0).toUpperCase();
    document.querySelectorAll('.avatar-ring img').forEach(el => {
      el.style.display = 'none'; // Ẩn ảnh mẫu đi
    });
    // Có thể code thêm logic tạo avatar chữ ở đây nếu cần

  } catch (err) {
    console.error('[Profile] Lỗi lấy thông tin user:', err);
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   LOAD ORDERS
   ════════════════════════════════════════════════════════════════════════════ */

async function loadOrderHistory() {
  const ordersList = document.getElementById('ordersList');
  if (!ordersList) return;

  ordersList.innerHTML = '<div style="text-align:center;padding:40px"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>';

  try {
    const res = await fetch(`${API_BASE}/profile/orders?per_page=20`, {
      headers: getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const orders = data.orders || [];

    if (!orders.length) {
      ordersList.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:#999">
          <i class="fa-solid fa-bag-shopping" style="font-size:48px;opacity:0.4;margin-bottom:16px"></i>
          <p style="font-size:16px">Chưa có đơn hàng nào</p>
          <p style="font-size:13px">Hãy khám phá bộ sưu tập nhạc cụ của chúng tôi!</p>
          <a href="/order" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#5c3d22;color:#f5e4c0;border-radius:6px;text-decoration:none;font-weight:700">
            Mua sắm ngay
          </a>
        </div>
      `;
      return;
    }

    ordersList.innerHTML = orders.map(order => renderOrderCard(order)).join('');

  } catch (err) {
    console.error('[Profile] Error:', err);
    ordersList.innerHTML = `
      <div style="color:red;padding:20px;text-align:center">
        <i class="fa-solid fa-triangle-exclamation"></i>
        Lỗi: ${err.message}
      </div>
    `;
  }
}

function renderOrderCard(order) {
  const statusInfo = formatStatus(order.status);
  const items = order.items || [];

  return `
    <div class="order-card" data-status="${order.status}">
      <div class="order-head">
        <div>
          <div class="order-id"><i class="fa-solid fa-hashtag"></i> ${order.order_code}</div>
          <div class="order-date"><i class="fa-regular fa-calendar"></i> ${formatDate(order.created_at)}</div>
        </div>
        <span class="status-badge ${statusInfo.class}">
          <i class="fa-solid ${statusInfo.icon}"></i> ${statusInfo.text}
        </span>
      </div>

      <div class="order-body">
        ${items.map(item => `
          <div class="order-item">
            <div class="item-thumb">
              ${item.product_img
                ? `<img src="${item.product_img}" alt="${item.product_name}" style="width:100%;height:100%;object-fit:cover">`
                : `<i class="fa-solid ${item.item_type === 'course' ? 'fa-graduation-cap' : 'fa-guitar'}" style="font-size:24px;color:#a08060;display:block;text-align:center;line-height:48px"></i>`}
            </div>
            <div>
              <div class="item-name">${item.product_name}</div>
              <div class="item-sub">${item.product_cat || 'Sản phẩm'}${item.quantity > 1 ? ` · SL: ${item.quantity}` : ''}</div>
            </div>
            <div class="item-price">${formatPrice(item.line_total)}</div>
          </div>
        `).join('')}
      </div>

      <div class="order-foot">
        <div class="order-total"><span>Tổng:</span> <strong>${formatPrice(order.total)}</strong></div>
        <button class="btn-track" onclick="openModal('${order.order_code}')">
          <i class="fa-solid fa-map-location-dot"></i> Theo dõi
        </button>
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════════════════════
   MODAL
   ════════════════════════════════════════════════════════════════════════════ */

function openModal(orderCode) {
  const modal = document.getElementById('timelineModal');
  const title = document.getElementById('tlOrderId');
  if (modal && title) {
    title.textContent = orderCode;
    modal.classList.add('show');
  }
}

function closeModal() {
  const modal = document.getElementById('timelineModal');
  if (modal) modal.classList.remove('show');
}

/* ════════════════════════════════════════════════════════════════════════════
   SECTION SWITCHING
   ════════════════════════════════════════════════════════════════════════════ */

function switchSection(sectionId) {
  document.querySelectorAll('section.card').forEach(sec => {
    sec.style.display = 'none';
  });

  const section = document.getElementById(sectionId);
  if (section) {
    section.style.display = 'block';
  }

  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.section === sectionId) {
      link.classList.add('active');
    }
  });

  if (sectionId === 'sec-orders') {
    loadOrderHistory();
  }
}

function logout() {
  if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
    localStorage.clear();
    window.location.href = '/';
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  loadUserInfo();
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = link.dataset.section;
      if (sectionId) switchSection(sectionId);
    });
  });

  switchSection('sec-info');

  const modal = document.getElementById('timelineModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
  }
  console.log('[Profile] Initialized');
});
window.switchSection = switchSection;
window.loadOrderHistory = loadOrderHistory;
window.openModal = openModal;
window.closeModal = closeModal;
window.logout = logout;