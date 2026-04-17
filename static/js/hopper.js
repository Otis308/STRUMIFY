(function () {
  "use strict";
  if (document.getElementById("hp-root")) return;

  /* ── CONFIG ── */
  const API_ENDPOINT = "/chat";
  const MAX_HISTORY  = 20;

  /* ── QUICK CHIPS ── */
  const CHIPS = [
    "🎸 Guitar cho người mới",
    "🎹 Tư vấn Piano điện",
    "🎻 Violin tầm giá nào?",
    "🥁 Học trống bắt đầu sao?",
    "💰 3 triệu mua được gì?",
    "🔧 Bảo dưỡng sửa chữa đàn",
    "🎓 Khóa học phù hợp cho mình?",
    "🏷️ Sản phẩm đang giảm giá",
  ];

  /* ── STATE ── */
  let isOpen  = false;
  let isBusy  = false;
  let history = [];

  /* ── HELPERS ── */
  function loggedIn() {
    const t = localStorage.getItem("access_token") || "";
    try { const p = JSON.parse(atob(t.split(".")[1])); return p.exp * 1000 > Date.now(); }
    catch { return false; }
  }
  function userName() { return localStorage.getItem("user_name") || "bạn"; }
  function esc(s) {
    return String(s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  /* ── BUILD SKELETON ── */
  injectCSS();

  const root = document.createElement("div");
  root.id = "hp-root";
  document.body.appendChild(root);

  /* FAB – hình tròn, chỉ logo/icon */
  const fab = document.createElement("button");
  fab.id = "hp-fab";
  fab.setAttribute("aria-label", "Tư vấn AI");
  fab.innerHTML = `
    <i class="fa-solid fa-headset" style="color: #FFFFFF; font-size: 22px; z-index: 2;"></i>
    <span class="hp-fab-emoji">💭</span>
    <span class="hp-fab-ring"></span>
  `;
  root.appendChild(fab);

  /* Chat box */
  const box = document.createElement("div");
  box.id = "hp-box";
  box.innerHTML = `
    <div class="hp-hdr">
      <div class="hp-hdr-l">
        <div class="hp-hdr-av">💭</div>
        <div>
          <div class="hp-hdr-name">Hopper · STRUMIFY</div>
          <div class="hp-hdr-status"><span class="hp-dot"></span>Đang trực tuyến</div>
        </div>
      </div>
      <div class="hp-hdr-r">
        <button id="hp-reset" title="Bắt đầu lại">↺</button>
        <button id="hp-close" title="Đóng">✕</button>
      </div>
    </div>

    <div class="hp-msgs" id="hp-msgs" role="log" aria-live="polite"></div>

    <div class="hp-chips" id="hp-chips"></div>

    <div class="hp-bar">
      <input id="hp-input" class="hp-input" type="text"
             placeholder="Nhập câu hỏi…" maxlength="400" autocomplete="off"/>
      <button id="hp-send" class="hp-send" title="Gửi">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>

    <div class="hp-foot">Powered by Gemini AI · STRUMIFY</div>
  `;
  root.appendChild(box);

  const msgsEl  = document.getElementById("hp-msgs");
  const chipsEl = document.getElementById("hp-chips");
  const input   = document.getElementById("hp-input");
  const sendBtn = document.getElementById("hp-send");

  /* ── RENDER ── */
  function addMsg(role, text) {
    const w = document.createElement("div");
    w.className = "hp-msg hp-msg-" + role;
    
    if (role === "bot") {
      let safeText = esc(text);

      // Chuyển đổi định dạng [Tên](Link) thành Action Card (Flexbox ngang)
      safeText = safeText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(match, name, url) {
        // Tự động đổi icon dựa theo tên sản phẩm
        let icon = "🎸";
        let lowerName = name.toLowerCase();
        if (lowerName.includes("piano")) icon = "🎹";
        if (lowerName.includes("violin")) icon = "🎻";
        if (lowerName.includes("trống") || lowerName.includes("drum")) icon = "🥁";

        // Trả về giao diện thẻ hp-action-card
        return `
        <div class="hp-action-card">
          <div class="hp-ac-icon">${icon}</div>
          <div class="hp-ac-content">
            <div class="hp-ac-title">${name}</div>
            <div class="hp-ac-desc">Nhấn xem chi tiết ưu đãi</div>
          </div>
          <a href="${url}" class="hp-ac-btn" target="_blank">Xem →</a>
        </div>`;
      });

      safeText = safeText.replace(/\n/g, "<br>");

      w.innerHTML = `<div class="hp-av">🎸</div>
        <div class="hp-bbl hp-bbl-bot">${safeText}</div>`;
    } else {
      w.innerHTML = `<div class="hp-bbl hp-bbl-usr">${esc(text)}</div>`;
    }
    msgsEl.appendChild(w);
    scroll();
  }

  function addCard(type) {
    const li = loggedIn();
    const MAP = {
      buy:    { icon: li?"🛒":"🔒", title: li?"Xem sản phẩm STRUMIFY":"Đăng nhập để mua hàng",
                desc: li?"Hàng trăm nhạc cụ chính hãng.":"Đăng nhập để thêm giỏ hàng!",
                href: li?"/order":"/login", label: li?"Xem →":"Đăng nhập" },
      course: { icon: li?"🎓":"🔒", title: li?"15+ khóa học âm nhạc":"Đăng nhập để đăng ký học",
                desc: li?"Guitar, Piano, Violin, Trống...":"Tạo tài khoản miễn phí!",
                href: li?"/courses":"/login", label: li?"Xem →":"Đăng nhập" },
      repair: { icon:"🔧", title:"Đặt lịch bảo dưỡng",
                desc:"Nghệ nhân chuyên nghiệp.",
                href:"/repair#booking", label:"Đặt lịch →" },
    };
    const d = MAP[type]; if (!d) return;
    const w = document.createElement("div");
    w.className = "hp-msg hp-msg-bot";
    w.innerHTML = `<div class="hp-av">🎸</div>
      <div class="hp-action-card">
        <div class="hp-ac-icon">${d.icon}</div>
        <div class="hp-ac-content">
          <div class="hp-ac-title">${d.title}</div>
          <div class="hp-ac-desc">${d.desc}</div>
        </div>
        <a href="${d.href}" class="hp-ac-btn">${d.label}</a>
      </div>`;
    msgsEl.appendChild(w);
    scroll();
  }

  function addTyping() {
    const w = document.createElement("div");
    w.className = "hp-msg hp-msg-bot"; w.id = "hp-typing";
    w.innerHTML = `<div class="hp-av">🎸</div>
      <div class="hp-bbl hp-bbl-bot hp-typing"><span></span><span></span><span></span></div>`;
    msgsEl.appendChild(w); scroll();
  }
  function rmTyping() { document.getElementById("hp-typing")?.remove(); }
  function scroll()   { msgsEl.scrollTop = msgsEl.scrollHeight; }

  /* ── CHIPS ── */
  function showChips(show) {
    chipsEl.innerHTML = "";
    if (!show) return;
    CHIPS.forEach(label => {
      const b = document.createElement("button");
      b.className = "hp-chip"; b.textContent = label;
      b.onclick = () => send(label);
      chipsEl.appendChild(b);
    });
  }

  /* ── INTENT ── */
  function detectIntent(text) {
    const t = text.toLowerCase();
    if (["mua","đặt hàng","giỏ hàng","xem sản phẩm","muốn mua","mua đàn"].some(k=>t.includes(k))) return "buy";
    if (["khóa học","học nhạc","học đàn","học guitar","học piano","đăng ký học","lớp học"].some(k=>t.includes(k))) return "course";
    if (["bảo dưỡng","sửa chữa","sửa đàn","đặt lịch sửa","hỏng","tiếng rè","refret","setup"].some(k=>t.includes(k))) return "repair";
    return null;
  }

  /* ── CALL BACKEND ── */
  async function callAPI(message) {
    const resp = await fetch(API_ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ message, history: history.slice(-MAX_HISTORY) }),
    });
    if (!resp.ok) {
      const e = await resp.json().catch(()=>({}));
      throw new Error(e.detail || "HTTP " + resp.status);
    }
    const data = await resp.json();
    return data.reply || "Xin lỗi, mình chưa nhận được phản hồi. Bạn thử lại nhé!";
  }

  /* ── SEND ── */
  async function send(text) {
    text = (text||"").trim();
    if (!text || isBusy) return;

    showChips(false);
    addMsg("user", text);
    history.push({ role: "user", content: text });

    isBusy = true;
    addTyping();
    syncSendBtn();

    try {
      const reply = await callAPI(text);
      rmTyping();
      addMsg("bot", reply);
      history.push({ role: "assistant", content: reply });
      if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);

      const intent = detectIntent(text + " " + reply);
      if (intent) setTimeout(() => addCard(intent), 400);
      if (history.length % 8 === 0) setTimeout(() => showChips(true), 600);

    } catch (err) {
      rmTyping();
      console.error("[Hopper]", err);
      addMsg("bot",
        "Xin lỗi, mình đang gặp sự cố kỹ thuật nhỏ.\n" +
        "Bạn gọi hotline hoặc zalo số 0944 024 055 để được hỗ trợ trực tiếp nhé!"
      );
    }

    isBusy = false;
    syncSendBtn();
  }

  function syncSendBtn() {
    sendBtn.disabled = isBusy;
    sendBtn.style.opacity = isBusy ? "0.45" : "1";
    sendBtn.style.cursor  = isBusy ? "not-allowed" : "pointer";
  }

  /* ── WELCOME ── */
  function welcome() {
    const li = loggedIn();
    const greet = li ? `Chào ${userName()} 👋` : "Chào bạn 👋";
    addMsg("bot",
      `${greet} Mình là Hopper – chuyên viên tư vấn nhạc cụ của STRUMIFY!\n\n` +
      `Mình có thể giúp bạn:\n` +
      `🎸 Chọn nhạc cụ phù hợp với trình độ & ngân sách\n` +
      `🎓 Tìm khóa học âm nhạc đúng với mục tiêu\n` +
      `🔧 Tư vấn bảo dưỡng & sửa chữa đàn\n\n` +
      `Bạn đang quan tâm đến điều gì hôm nay?`
    );
    showChips(true);
  }

  /* ── OPEN/CLOSE/RESET ── */
  function open() {
    isOpen = true;
    box.classList.add("hp-box--open");
    hideBadge();
    if (!msgsEl.childElementCount) welcome();
    setTimeout(() => input.focus(), 300);
  }
  function close() {
    isOpen = false;
    box.classList.remove("hp-box--open");
  }
  function reset() {
    if (history.length && !confirm("Xóa lịch sử và bắt đầu cuộc trò chuyện mới?")) return;
    history = [];
    msgsEl.innerHTML = "";
    showChips(false);
    welcome();
  }

  /* ── BADGE ── */
  function showBadge() {
    if (isOpen) return;
    let b = document.getElementById("hp-badge");
    if (!b) { b = document.createElement("span"); b.id = "hp-badge"; b.textContent = "1"; fab.appendChild(b); }
    b.style.display = "flex";
  }
  function hideBadge() {
    const b = document.getElementById("hp-badge");
    if (b) b.style.display = "none";
  }

  /* ── EVENTS ── */
  fab.onclick = () => (isOpen ? close() : open());
  document.getElementById("hp-close").onclick = close;
  document.getElementById("hp-reset").onclick = reset;
  sendBtn.onclick = () => { send(input.value); input.value = ""; };
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(e.target.value);
      e.target.value = "";
    }
  });

  setTimeout(showBadge, 4000);

  /* ── CSS ── */
  function injectCSS() {
    if (document.getElementById("hp-css")) return;
    const s = document.createElement("style");
    s.id = "hp-css";
    s.textContent = `
      /* ─── FAB hình tròn ─── */
      #hp-fab {
        position: fixed; bottom: 24px; right: 24px;
        z-index: 999990;
        width: 58px; height: 58px; border-radius: 50%;
        background: linear-gradient(145deg, #5c3d22 0%, #c9922a 100%);
        border: none; cursor: pointer; padding: 0; overflow: visible;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 6px 22px rgba(92,61,34,.5);
        transition: transform .25s cubic-bezier(.22,.9,.35,1.3), box-shadow .25s;
      }
      #hp-fab:hover { transform: scale(1.13); box-shadow: 0 10px 30px rgba(92,61,34,.6); }
      #hp-fab:active { transform: scale(.94); }

      .hp-fab-emoji {
        font-size: 26px; line-height: 1;
        display: none;
      }
      .hp-fab-ring {
        position: absolute; inset: -5px; border-radius: 50%;
        border: 2.5px solid rgba(201,146,42,.5);
        animation: hpRing 2.4s ease infinite;
        pointer-events: none;
      }
      @keyframes hpRing {
        0%,100% { transform:scale(1);   opacity:.7; }
        50%      { transform:scale(1.22); opacity:0; }
      }

      /* Badge đỏ */
      #hp-badge {
        position: absolute; top: -2px; right: -2px;
        width: 18px; height: 18px;
        background: #e74c3c; color: #fff;
        font-size: 10px; font-weight: 900;
        border-radius: 50%;
        display: none; align-items: center; justify-content: center;
        border: 2px solid #fff;
        font-family: 'Nunito','DM Sans',sans-serif;
        animation: hpBlink 1.8s ease infinite;
      }
      @keyframes hpBlink {
        0%,100% { box-shadow:0 0 0 0 rgba(231,76,60,.6); }
        50%      { box-shadow:0 0 0 5px rgba(231,76,60,0); }
      }

      /* ─── Chat box ─── */
      #hp-box {
        position: fixed; bottom: 96px; right: 22px;
        z-index: 999991;
        width: 376px; max-height: 590px;
        background: #fdf7f0;
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(30,10,0,.22), 0 4px 14px rgba(0,0,0,.1);
        border: 1px solid rgba(201,146,42,.22);
        display: flex; flex-direction: column; overflow: hidden;
        font-family: 'Nunito','DM Sans',sans-serif;
        transform: translateY(14px) scale(.96);
        opacity: 0; pointer-events: none;
        transition: transform .26s cubic-bezier(.22,.9,.35,1), opacity .26s ease;
      }
      #hp-box.hp-box--open {
        transform: translateY(0) scale(1);
        opacity: 1; pointer-events: all;
      }

      /* Header */
      .hp-hdr {
        background: linear-gradient(135deg, #3a2410, #5c3d22 55%, #7a5230);
        padding: 13px 14px;
        display: flex; align-items: center; justify-content: space-between;
        flex-shrink: 0;
      }
      .hp-hdr-l { display:flex; align-items:center; gap:10px; }
      .hp-hdr-av {
        width:36px; height:36px; border-radius:50%;
        background:rgba(255,255,255,.14);
        border:2px solid rgba(201,146,42,.5);
        display:flex; align-items:center; justify-content:center;
        font-size:17px; flex-shrink:0;
      }
      .hp-hdr-name  { color:#f5e4c0; font-size:13px; font-weight:800; line-height:1.2; }
      .hp-hdr-status {
        display:flex; align-items:center; gap:5px;
        color:rgba(245,228,192,.6); font-size:10.5px; margin-top:2px;
      }
      .hp-dot {
        width:6px; height:6px; background:#2ecc71; border-radius:50%;
        animation: dotBlink 2s ease infinite;
      }
      @keyframes dotBlink { 0%,100%{opacity:1} 50%{opacity:.3} }
      .hp-hdr-r { display:flex; gap:6px; }
      .hp-hdr-r button {
        background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.2);
        color:#f5e4c0; width:27px; height:27px; border-radius:7px;
        font-size:13px; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        transition:background .15s; font-family:inherit;
      }
      .hp-hdr-r button:hover { background:rgba(255,255,255,.25); }

      /* Messages */
      .hp-msgs {
        flex:1; overflow-y:auto; padding:13px 11px;
        display:flex; flex-direction:column; gap:9px;
        scroll-behavior:smooth;
      }
      .hp-msgs::-webkit-scrollbar { width:3px; }
      .hp-msgs::-webkit-scrollbar-thumb { background:#d4b896; border-radius:99px; }

      .hp-msg { display:flex; align-items:flex-end; gap:6px; }
      .hp-msg-bot  { justify-content:flex-start; }
      .hp-msg-user { justify-content:flex-end; }

      .hp-av {
        width:25px; height:25px; border-radius:50%;
        background:linear-gradient(135deg,#5c3d22,#c9922a);
        display:flex; align-items:center; justify-content:center;
        font-size:11px; flex-shrink:0;
      }
      .hp-bbl {
        max-width:79%; padding:9px 12px; border-radius:15px;
        font-size:13.5px; line-height:1.65; word-break:break-word;
        animation:hpUp .22s ease;
      }
      @keyframes hpUp { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:translateY(0)} }
      .hp-bbl-bot {
        background:#fff; color:#2a1a0e;
        border:1px solid #ead9c4; border-bottom-left-radius:4px;
        box-shadow:0 2px 8px rgba(74,46,20,.06);
      }
      .hp-bbl-usr {
        background:linear-gradient(135deg,#5c3d22,#7a5230);
        color:#f5e4c0; border-bottom-right-radius:4px;
      }

      /* Action Card (Flexbox ngang) */
      .hp-action-card {
        display: flex;
        align-items: center;
        background: #fff;
        border: 1.5px solid #c9922a;
        border-radius: 10px;
        padding: 8px 12px;
        margin: 8px 0;
        gap: 12px;
        box-shadow: 0 4px 12px rgba(201,146,42,0.1);
        text-decoration: none;
        max-width: 100%;
        box-sizing: border-box;
      }
      .hp-ac-icon {
        font-size: 24px;
        flex-shrink: 0;
      }
      .hp-ac-content {
        flex: 1;
        min-width: 0;
      }
      .hp-ac-title {
        font-size: 13px;
        font-weight: 800;
        color: #2a1a0e;
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hp-ac-desc {
        font-size: 11px;
        color: #7a5230;
      }
      .hp-ac-btn {
        background: linear-gradient(135deg, #5c3d22, #c9922a);
        color: #f5e4c0;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 11.5px;
        font-weight: bold;
        text-decoration: none;
        white-space: nowrap;
        flex-shrink: 0;
        transition: filter 0.15s;
      }
      .hp-ac-btn:hover {
        filter: brightness(1.1);
      }

      /* Typing */
      .hp-typing {
        display:flex !important; align-items:center; gap:4px;
        padding:11px 15px !important;
      }
      .hp-typing span {
        display:block; width:6px; height:6px; border-radius:50%;
        background:#c9922a; animation:hpDot 1.2s ease infinite;
      }
      .hp-typing span:nth-child(2){animation-delay:.18s}
      .hp-typing span:nth-child(3){animation-delay:.36s}
      @keyframes hpDot {
        0%,80%,100%{transform:translateY(0);opacity:.4}
        40%{transform:translateY(-5px);opacity:1}
      }

      /* Chips */
      .hp-chips {
        display:flex; flex-wrap:wrap; gap:6px;
        padding:2px 11px 7px; flex-shrink:0;
        max-height:78px; overflow-y:auto;
      }
      .hp-chip {
        padding:5px 10px; border-radius:50px;
        border:1.5px solid #ead9c4;
        background:#fff; color:#7a5230;
        font-size:11.5px; font-weight:700;
        cursor:pointer; font-family:inherit;
        transition:all .15s; white-space:nowrap;
      }
      .hp-chip:hover {
        background:#7a5230; color:#f5e4c0;
        border-color:#7a5230; transform:translateY(-1px);
      }

      /* Input bar */
      .hp-bar {
        display:flex; gap:8px; padding:9px 11px;
        border-top:1px solid #ead9c4;
        background:#fff; flex-shrink:0;
      }
      .hp-input {
        flex:1; padding:8px 12px; border-radius:11px;
        border:1.5px solid #ead9c4; background:#fdf7f0;
        font-size:13.5px; font-family:inherit; color:#2a1a0e;
        outline:none; transition:border-color .15s, background .15s;
        min-width:0;
      }
      .hp-input:focus { border-color:#c9922a; background:#fff; }
      .hp-input::placeholder { color:#c4a882; }
      .hp-send {
        width:36px; height:36px; border-radius:10px;
        background:linear-gradient(135deg,#5c3d22,#c9922a);
        border:none; color:#f5e4c0; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        flex-shrink:0; transition:transform .15s, filter .15s;
      }
      .hp-send:hover  { transform:scale(1.08); filter:brightness(1.1); }
      .hp-send:active { transform:scale(.93); }

      /* Footer */
      .hp-foot {
        text-align:center; font-size:9.5px; color:#c4a882;
        padding:4px 0 7px; background:#fff; flex-shrink:0;
        letter-spacing:.03em;
      }

      /* Mobile */
      @media (max-width:480px) {
        #hp-box {
          width:calc(100vw - 14px); right:7px;
          bottom:86px; max-height:74vh; border-radius:18px;
        }
        #hp-fab { right:14px; bottom:14px; width:52px; height:52px; }
      }
    `;
    document.head.appendChild(s);
  }

})();
