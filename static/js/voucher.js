/* Mã giảm giá hợp lệ */
window.MOC_COUPONS = {
  'MOC10':    { type:'percent', value:10,      label:'Giảm 10%' },
  'MOC20':    { type:'percent', value:20,      label:'Giảm 20%' },
  'MOC30':    { type:'percent', value:30,      label:'Giảm 30%' },
  'NEWUSER':  { type:'percent', value:15,      label:'Khách mới -15%' },
  'GUITAR50': { type:'fixed',   value:500000,  label:'Giảm 500.000₫' },
  'SALE100':  { type:'fixed',   value:1000000, label:'Giảm 1.000.000₫' },
  'VIP25':    { type:'percent', value:25,      label:'VIP -25%' },
};

/* ══════════════════════════════════════════════════════════
   ⚠️  QUAN TRỌNG – Cấu hình ngân hàng (điền thông tin của bạn)
   ══════════════════════════════════════════════════════════
   BIN ngân hàng phổ biến dùng cho VietQR:
     Vietcombank = 970436  |  Techcombank = 970407
     MB Bank     = 970422  |  ACB         = 970416
     VPBank      = 970432  |  BIDV        = 970418
     Vietinbank  = 970415  |  TPBank      = 970423
     Sacombank   = 970403  |  HDBank      = 970437
   ══════════════════════════════════════════════════════════ */
window.MOC_BANK = {
  bankId:      'VCB',                          // ← Viết tắt ngân hàng
  bankBin:     '970436',                       // ← BIN ngân hàng cho VietQR
  accountNo:   '1234567890',                   // ← SỐ TÀI KHOẢN CỦA BẠN
  accountName: 'CONG TY TNHH MOC INSTRUMENT', // ← TÊN CHỦ TK (IN HOA, không dấu)
  bankFullName:'Vietcombank',                  // ← Tên đầy đủ
  branch:      'CN TP. Hồ Chí Minh',
};