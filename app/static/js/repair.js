/* ================================================================
   STRUMIFY – repair.js
   Handles: Service tabs, Booking form, File upload, Order tracking
   ================================================================ */
'use strict';

/* ── TOAST ──────────────────────────────────────────────────── */
let _rpToastTimer = null;
function rpToast(msg, type = 'info') {
  const el   = document.getElementById('rpToast');
  const icon = document.getElementById('rpToastIcon');
  const text = document.getElementById('rpToastText');
  if (!el) return;

  icon.textContent = type === 'ok' ? '✓' : type === 'err' ? '✕' : 'ℹ';
  text.textContent = msg;
  el.className = `rp-toast show ${type}`;

  clearTimeout(_rpToastTimer);
  _rpToastTimer = setTimeout(() => el.classList.remove('show'), 3400);
}

/* ── SERVICE TABS ───────────────────────────────────────────── */
function initServiceTabs() {
  const tabs   = document.querySelectorAll('.svc-tab');
  const panels = document.querySelectorAll('.svc-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const target = document.getElementById(`panel-${tab.dataset.panel}`);
      if (target) target.classList.add('active');
    });
  });
}

/* ── FILE UPLOAD ────────────────────────────────────────────── */
const MAX_FILES = 5;
const MAX_SIZE  = 20 * 1024 * 1024; // 20MB
let selectedFiles = [];

function initFileUpload() {
  const zone    = document.getElementById('uploadZone');
  const input   = document.getElementById('fileInput');
  const preview = document.getElementById('filePreview');
  if (!zone || !input) return;

  // Drag & drop
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFiles(Array.from(e.dataTransfer.files));
  });

  input.addEventListener('change', () => handleFiles(Array.from(input.files)));
}

function handleFiles(newFiles) {
  const preview = document.getElementById('filePreview');

  newFiles.forEach(file => {
    if (selectedFiles.length >= MAX_FILES) {
      rpToast(`Tối đa ${MAX_FILES} file`, 'err'); return;
    }
    if (file.size > MAX_SIZE) {
      rpToast(`"${file.name}" vượt quá 20MB`, 'err'); return;
    }
    if (selectedFiles.find(f => f.name === file.name && f.size === file.size)) return;

    selectedFiles.push(file);
    renderPreview(file, selectedFiles.length - 1);
  });
}

function renderPreview(file, idx) {
  const preview = document.getElementById('filePreview');
  const item = document.createElement('div');
  item.className = 'bf-preview-item';
  item.id = `prev-${idx}`;

  const isVideo = file.type.startsWith('video/');
  const url = URL.createObjectURL(file);

  item.innerHTML = isVideo
    ? `<video src="${url}" muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:8px"></video>`
    : `<img src="${url}" alt="${file.name}">`;

  const rmBtn = document.createElement('button');
  rmBtn.className = 'rm-file';
  rmBtn.innerHTML = '✕';
  rmBtn.title = 'Xóa';
  rmBtn.onclick = () => {
    selectedFiles.splice(idx, 1);
    item.remove();
    // re-index
    document.querySelectorAll('.bf-preview-item').forEach((el, i) => el.id = `prev-${i}`);
  };

  item.appendChild(rmBtn);
  preview.appendChild(item);
}

/* ── SET MIN DATE for date picker ───────────────────────────── */
function initDatePicker() {
  const dateInput = document.getElementById('preferredDate');
  if (!dateInput) return;
  const today = new Date();
  today.setDate(today.getDate() + 1); // min = ngày mai
  dateInput.min = today.toISOString().split('T')[0];
}

/* ── BOOKING FORM SUBMIT ────────────────────────────────────── */
function initBookingForm() {
  const form = document.getElementById('bookingForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('bookingSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi…';

    try {
      const fd = new FormData(form);

      // Attach selected files
      selectedFiles.forEach((file, i) => {
        fd.set(`media`, file); // server nhận file đầu tiên; nếu cần nhiều: append
      });
      // Nếu server hỗ trợ multiple files thì dùng:
      // selectedFiles.forEach(f => fd.append('media', f));

      const token = localStorage.getItem('access_token') || '';
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res  = await fetch('/repairs/bookings/', { method: 'POST', headers, body: fd });
      const data = await res.json();

      if (res.ok || res.status === 201) {
        showBookingSuccess(data.order_code || data.code || 'SVC-' + Date.now().toString().slice(-6));
      } else {
        throw new Error(data.detail || 'Lỗi gửi đơn');
      }
    } catch (err) {
      rpToast(err.message, 'err');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi yêu cầu đặt lịch';
    }
  });
}

function showBookingSuccess(code) {
  document.getElementById('bookingForm').classList.add('hidden');
  document.getElementById('bookingSuccess').classList.remove('hidden');
  document.getElementById('bookingCode').textContent = code;
}

window.resetBookingForm = function () {
  document.getElementById('bookingForm').reset();
  document.getElementById('bookingForm').classList.remove('hidden');
  document.getElementById('bookingSuccess').classList.add('hidden');
  document.getElementById('filePreview').innerHTML = '';
  selectedFiles = [];
  const btn = document.getElementById('bookingSubmitBtn');
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi yêu cầu đặt lịch'; }
};

/* ── ORDER TRACKING ─────────────────────────────────────────── */
const STATUS_ORDER = ['pending', 'diagnosing', 'waiting_approval', 'repairing', 'testing', 'completed'];
const STATUS_LABEL = {
  pending:          'Tiếp nhận',
  diagnosing:       'Đang giám định',
  waiting_approval: 'Chờ khách duyệt giá',
  repairing:        'Đang sửa chữa',
  testing:          'Kiểm âm & hoàn thiện',
  completed:        'Đã hoàn thành',
};

window.trackOrder = async function () {
  const code    = document.getElementById('trackCodeInput')?.value.trim();
  const result  = document.getElementById('trackResult');
  const empty   = document.getElementById('trackEmpty');
  const btn     = document.getElementById('trackBtn');

  if (!code) { rpToast('Vui lòng nhập mã đơn hàng', 'err'); return; }

  result?.classList.add('hidden');
  empty?.classList.add('hidden');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    const token = localStorage.getItem('access_token') || '';
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    const res  = await fetch(`/repairs/track/${encodeURIComponent(code)}`, { headers });
    const data = await res.json();

    if (res.ok && data) {
      renderTrackResult(data);
    } else {
      empty?.classList.remove('hidden');
    }
  } catch (err) {
    // Dev/demo fallback: hiển thị dữ liệu mẫu nếu API chưa chạy
    renderTrackResult(_demoOrder(code));
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Tra cứu';
  }
};

function renderTrackResult(order) {
  const result = document.getElementById('trackResult');
  if (!result) return;

  // Thông tin cơ bản
  document.getElementById('trOrderId').textContent    = order.code        || order.order_code || '—';
  document.getElementById('trInstrument').textContent = order.instrument  || '—';
  document.getElementById('trTechnician').textContent = order.technician  || 'Đang phân công';
  document.getElementById('trETA').textContent        = order.eta         || '—';

  // Progress steps
  const currentIdx = STATUS_ORDER.indexOf(order.status);
  document.querySelectorAll('.tp-step').forEach((step, i) => {
    step.classList.remove('done', 'active');
    if (i < currentIdx)  step.classList.add('done');
    if (i === currentIdx) step.classList.add('active');
  });
  document.querySelectorAll('.tp-line').forEach((line, i) => {
    line.classList.toggle('done', i < currentIdx);
  });

  // Logs
  const logList = document.getElementById('trackLogs');
  if (logList && order.logs && order.logs.length) {
    logList.innerHTML = order.logs.map(log => `
      <div class="tl-item">
        <div class="tl-dot"></div>
        <div class="tl-content">
          <div class="tl-status">${STATUS_LABEL[log.status] || log.status}</div>
          ${log.note ? `<div class="tl-note">${log.note}</div>` : ''}
        </div>
        <div class="tl-meta">${_fmtDate(log.created_at)}</div>
      </div>`).join('');
  } else if (logList) {
    logList.innerHTML = '<p style="font-size:13px;color:var(--rp-muted);padding:8px 0">Chưa có lịch sử cập nhật.</p>';
  }

  result.classList.remove('hidden');
  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* Demo order khi API chưa có */
function _demoOrder(code) {
  return {
    code,
    instrument: 'Guitar Acoustic – Yamaha F310',
    technician: 'Nguyễn Minh Tuấn',
    eta: '28/03/2026',
    status: 'repairing',
    logs: [
      { status: 'pending',    note: 'Đơn hàng được tạo thành công.',          created_at: '2026-03-24T08:30:00' },
      { status: 'diagnosing', note: 'Kỹ thuật viên đã nhận đàn, bắt đầu kiểm tra.', created_at: '2026-03-24T14:10:00' },
      { status: 'waiting_approval', note: 'Báo giá: Refret + setup 1.450.000₫. Chờ khách xác nhận.', created_at: '2026-03-25T09:00:00' },
      { status: 'repairing',  note: 'Khách đã duyệt. Đang tiến hành thay phím fret.',  created_at: '2026-03-25T11:30:00' },
    ],
  };
}

function _fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

/* ── Enter key to track ─────────────────────────────────────── */
function initTrackEnter() {
  document.getElementById('trackCodeInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') window.trackOrder();
  });
}

/* ── SCROLL REVEAL ──────────────────────────────────────────── */
function initScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.style.opacity    = '1';
        en.target.style.transform  = 'translateY(0)';
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll(
    '.svc-card, .price-card, .team-card, .guide-card, .warranty-card, .wf-step'
  ).forEach(el => {
    el.style.cssText += 'opacity:0;transform:translateY(24px);transition:opacity .5s ease,transform .5s ease;';
    io.observe(el);
  });
}

/* ── SMOOTH ANCHOR SCROLL ───────────────────────────────────── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ── INIT ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initServiceTabs();
  initFileUpload();
  initDatePicker();
  initBookingForm();
  initTrackEnter();
  initScrollReveal();
  initSmoothScroll();
});