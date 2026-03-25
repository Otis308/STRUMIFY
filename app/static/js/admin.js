/* =============================================
   STRUMIFY – admin.js  (Supabase API)
   ============================================= */
'use strict';

const API  = '';
const fmt  = n => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(n);
function getToken() { return localStorage.getItem('access_token') || ''; }
function authH()    { return { 'Content-Type':'application/json', 'Authorization':`Bearer ${getToken()}` }; }

let prods  = [];
let orders = [];
let users  = [];

/* ── TOAST ─────────────────────────────────── */
function toast(msg, type='success') {
  const el = document.getElementById('toast-el');
  if (!el) return;
  el.innerHTML = `${type==='success'?'✅':'❌'} ${msg}`;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

/* ── NAV ───────────────────────────────────── */
const TABS = {
  dashboard: ['Dashboard', 'Tổng quan hệ thống'],
  products:  ['Sản phẩm',  'Quản lý kho hàng'],
  orders:    ['Đơn hàng',  'Quản lý & xử lý đơn'],
  customers: ['Khách hàng','Danh sách thành viên'],
};

function gotoTab(btn) {
  const tab = btn.dataset.tab;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + tab)?.classList.add('active');
  btn.classList.add('active');
  document.getElementById('ttitle').textContent = TABS[tab]?.[0] || tab;
  document.getElementById('tsub').textContent   = TABS[tab]?.[1] || '';
  if (tab === 'dashboard') renderDash();
  if (tab === 'products')  renderProds();
  if (tab === 'orders')    renderOrders();
  if (tab === 'customers') renderCustomers();
}
function gotoTabById(id) { const b = document.querySelector(`[data-tab="${id}"]`); if (b) gotoTab(b); }

/* ── FETCH FROM SUPABASE ────────────────────── */
async function fetchAll() {
  try {
    const [ordRes, prodRes, userRes] = await Promise.all([
      fetch(`${API}/admin/orders`,    { headers: authH() }),
      fetch(`${API}/admin/products`,  { headers: authH() }),
      fetch(`${API}/admin/customers`, { headers: authH() }),
    ]);

    if (ordRes.ok)  { const d = await ordRes.json();  orders = d.orders   || []; }
    if (prodRes.ok) { const d = await prodRes.json(); prods  = d.products || []; }
    if (userRes.ok) { const d = await userRes.json(); users  = d.users    || []; }
  } catch (e) {
    console.error('fetchAll error:', e);
    // Fallback demo data nếu API chưa có
    orders = orders.length ? orders : DEMO_ORDERS;
    prods  = prods.length  ? prods  : DEMO_PRODS;
  }
}

/* ── DEMO DATA (fallback) ───────────────────── */
const DEMO_PRODS = [
  {id:1,cat:'Guitar',name:'Guitar Acoustic Yamaha F310',price:3500000,import_price:2800000,stock:15},
  {id:2,cat:'Guitar',name:'Guitar Acoustic Taylor 214ce',price:22000000,import_price:18000000,stock:3},
  {id:3,cat:'Piano', name:'Piano Điện Yamaha P-45',price:9800000,import_price:8000000,stock:5},
];
const DEMO_ORDERS = [
  {order_code:'MOC-001',created_at:new Date().toISOString(),receiver_name:'Nguyễn Văn A',items:[{product_name:'Guitar Yamaha F310',qty:1,price_at_purchase:3500000}],total:3500000,status:'delivered',pay_method:'cod'},
  {order_code:'MOC-002',created_at:new Date().toISOString(),receiver_name:'Trần Thị B',  items:[{product_name:'Piano Điện Yamaha P-45',qty:1,price_at_purchase:9800000}],total:9800000,status:'processing',pay_method:'bank'},
];

/* ── DASHBOARD ──────────────────────────────── */
function renderDash() {
  const delivered = orders.filter(o => o.status === 'delivered');
  const totalRev  = delivered.reduce((s,o) => s + (o.total||0), 0);
  const totalCost = delivered.reduce((s,o) => {
    return s + (o.items||[]).reduce((ss,it) => {
      const p = prods.find(p => p.name === it.product_name || p.id === it.product_id);
      return ss + (p ? (p.import_price||0) * it.quantity : 0);
    }, 0);
  }, 0);
  const totalStock = prods.reduce((s,p) => s + (p.stock||0), 0);

  setText('s-rev',    fmt(totalRev));
  setText('s-profit', fmt(totalRev - totalCost));
  setText('s-ord',    orders.length);
  setText('s-stock',  totalStock);
  setText('s-users',  users.length);

  // Tier breakdown
  const tierCount = { new:0, silver:0, gold:0, diamond:0 };
  users.forEach(u => { const t = u.membership_tier||'new'; tierCount[t] = (tierCount[t]||0)+1; });
  setText('s-tier-new',     tierCount.new);
  setText('s-tier-silver',  tierCount.silver);
  setText('s-tier-gold',    tierCount.gold);
  setText('s-tier-diamond', tierCount.diamond);

  // Recent orders
  const tbody = document.getElementById('dash-ord');
  if (tbody) tbody.innerHTML = orders.slice(0,8).map(o => `
    <tr>
      <td style="color:var(--gold);font-weight:700">${o.order_code}</td>
      <td>${o.receiver_name || '–'}</td>
      <td>${(o.items||[]).map(i=>i.product_name).join(', ').substring(0,40)}…</td>
      <td style="font-weight:700">${fmt(o.total||0)}</td>
      <td><span class="badge ${statusBadge(o.status)}">${statusLabel(o.status)}</span></td>
      <td>${o.created_at ? new Date(o.created_at).toLocaleDateString('vi-VN') : ''}</td>
      <td>
        <select class="status-sel" onchange="updateOrderStatus('${o.order_code}', this.value)">
          ${['processing','confirmed','shipping','delivered','cancelled'].map(s =>
            `<option value="${s}"${s===o.status?' selected':''}>${statusLabel(s)}</option>`
          ).join('')}
        </select>
      </td>
    </tr>`).join('');
}

/* ── PRODUCTS ───────────────────────────────── */
function renderProds() {
  setText('prod-count', `${prods.length} sản phẩm`);
  const tbody = document.getElementById('prod-body');
  if (tbody) tbody.innerHTML = prods.map(p => `
    <tr>
      <td>#${p.id}</td>
      <td>${p.img?`<img src="${p.img}" style="width:44px;height:44px;object-fit:cover;border-radius:8px">`:'<i class="fa-solid fa-guitar" style="font-size:20px;color:var(--gold)"></i>'}</td>
      <td style="font-weight:700">${p.name}</td>
      <td>${p.cat||'–'}</td>
      <td><span class="${(p.stock||0)<5?'badge b-warn':''}">${p.stock??0}</span></td>
      <td style="color:var(--muted)">${fmt(p.import_price||0)}</td>
      <td style="color:var(--gold);font-weight:700">${fmt(p.price||0)}</td>
      <td><button class="btn btn-ghost" onclick="toast('Tính năng đang phát triển')">Sửa</button></td>
    </tr>`).join('');
}

/* ── ORDERS ─────────────────────────────────── */
function renderOrders(filter='all') {
  const list = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  tbody.innerHTML = list.map(o => `
    <tr>
      <td style="color:var(--gold);font-weight:700">${o.order_code}</td>
      <td>${o.receiver_name||'–'}</td>
      <td style="font-size:12px">${o.receiver_phone||'–'}</td>
      <td>${(o.items||[]).map(i=>`${i.product_name} ×${i.quantity}`).join('<br>')}</td>
      <td style="font-weight:700">${fmt(o.total||0)}</td>
      <td>${payLabel(o.pay_method)}</td>
      <td>${o.created_at?new Date(o.created_at).toLocaleDateString('vi-VN'):''}</td>
      <td>
        <select class="status-sel" onchange="updateOrderStatus('${o.order_code}',this.value)">
          ${['processing','confirmed','shipping','delivered','cancelled'].map(s =>
            `<option value="${s}"${s===o.status?' selected':''}>${statusLabel(s)}</option>`
          ).join('')}
        </select>
      </td>
    </tr>`).join('');
}

async function updateOrderStatus(code, status) {
  try {
    const res = await fetch(`${API}/orders/${code}/status?new_status=${status}`, { method:'PUT', headers: authH() });
    if (res.ok) {
      const o = orders.find(x => x.order_code === code);
      if (o) o.status = status;
      toast(`Đơn ${code} → ${statusLabel(status)}`);
      renderDash();
    } else { toast('Cập nhật thất bại', 'error'); }
  } catch { toast('Lỗi kết nối', 'error'); }
}

/* ── CUSTOMERS ──────────────────────────────── */
const TIER_COLOR = { new:'#8a6f55', silver:'#64748b', gold:'#b45309', diamond:'#6d28d9' };
const TIER_LABEL = { new:'Mới', silver:'Bạc', gold:'Vàng', diamond:'Kim Cương' };

function renderCustomers() {
  const tbody = document.getElementById('customers-body');
  if (!tbody) return;
  tbody.innerHTML = users.map(u => {
    const tier = u.membership_tier || 'new';
    return `<tr>
      <td>#${u.id}</td>
      <td style="font-weight:700">${u.username||'–'}</td>
      <td>${u.email}</td>
      <td>${u.phone||'–'}</td>
      <td><span style="color:${TIER_COLOR[tier]};font-weight:700"><i class="fa-solid ${tierIcon(tier)}"></i> ${TIER_LABEL[tier]||tier}</span></td>
      <td>${u.order_count||0}</td>
      <td>${fmt(u.total_spent||0)}</td>
      <td>${u.created_at?new Date(u.created_at).toLocaleDateString('vi-VN'):''}</td>
    </tr>`;
  }).join('');
}

/* ── HELPERS ───────────────────────────────── */
function statusLabel(s) { return {processing:'Xử lý',confirmed:'Xác nhận',shipping:'Đang giao',delivered:'Đã nhận',cancelled:'Đã hủy'}[s]||s; }
function statusBadge(s) { return {processing:'b-proc',confirmed:'b-proc',shipping:'b-ship',delivered:'b-done',cancelled:'b-cancel'}[s]||'b-proc'; }
function payLabel(s)    { return {cod:'Tiền mặt',bank:'Chuyển khoản',momo:'MoMo/ZaloPay'}[s]||s||'–'; }
function tierIcon(t)    { return {new:'fa-seedling',silver:'fa-medal',gold:'fa-crown',diamond:'fa-gem'}[t]||'fa-seedling'; }
function setText(id,v)  { const el=document.getElementById(id); if(el) el.textContent=v; }

/* ── INIT ──────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Kiểm tra quyền admin
  const role = localStorage.getItem('user_role');
  if (!localStorage.getItem('access_token') || role !== 'admin') {
    window.location.href = '/login'; return;
  }
  await fetchAll();
  renderDash();
});