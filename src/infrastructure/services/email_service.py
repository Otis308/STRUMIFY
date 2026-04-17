"""
services/email_service.py – Strumify
Gửi email thông báo đăng ký khóa học cho học viên.

Cài đặt: pip install fastapi-mail
Biến .env cần có:

"""
from __future__ import annotations

import os
from typing import Optional


# ── EMAIL TEMPLATE HTML ──────────────────────────────────────────
def build_enrollment_email(
    student_name:   str,
    student_code:   str,
    course_name:    str,
    class_name:     str,
    schedule:       Optional[str],
    instructor:     Optional[str],
) -> str:
    """Trả về nội dung HTML của email xác nhận đăng ký khóa học."""
    schedule_row = f"""
        <div class="info-row">
          <span class="info-label">Lịch học</span>
          <span class="info-value">{schedule or 'Sẽ thông báo sau'}</span>
        </div>""" if schedule else ""

    instructor_row = f"""
        <div class="info-row">
          <span class="info-label">Giảng viên</span>
          <span class="info-value">{instructor or 'Sẽ thông báo sau'}</span>
        </div>""" if instructor else ""

    base_url = os.getenv("APP_BASE_URL", "https://strumify.vn")

    return f"""
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác nhận đăng ký khóa học – STRUMIFY</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: 'Nunito', 'Segoe UI', Arial, sans-serif; background: #f5ede4; padding: 32px 16px; }}
    .wrapper {{ max-width: 560px; margin: 0 auto; }}
    .header {{
      background: linear-gradient(135deg, #5c3d22 0%, #7a5230 100%);
      border-radius: 16px 16px 0 0;
      padding: 32px 28px 24px;
      text-align: center;
    }}
    .brand {{ color: #f5e4c0; font-size: 28px; font-weight: 900; letter-spacing: 3px; }}
    .header-sub {{ color: rgba(245,228,192,.7); font-size: 13px; margin-top: 4px; }}
    .body {{
      background: #fff;
      padding: 32px 28px;
      border-left: 1px solid #ead9c4;
      border-right: 1px solid #ead9c4;
    }}
    .greeting {{ font-size: 16px; color: #2a1a0e; margin-bottom: 8px; }}
    .greeting strong {{ color: #5c3d22; }}
    .subtitle {{ font-size: 14px; color: #7a6a5a; line-height: 1.7; margin-bottom: 24px; }}
    .student-code-box {{
      background: #fdf6ee;
      border: 2px dashed #c9922a;
      border-radius: 12px;
      padding: 16px 20px;
      text-align: center;
      margin-bottom: 24px;
    }}
    .student-code-label {{ font-size: 11px; color: #a08060; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }}
    .student-code {{ font-size: 26px; font-weight: 900; color: #5c3d22; letter-spacing: 4px; margin-top: 6px; }}
    .info-card {{
      background: #fdf6ee;
      border-radius: 12px;
      border: 1px solid #ead9c4;
      overflow: hidden;
      margin-bottom: 24px;
    }}
    .info-card-header {{
      background: linear-gradient(90deg, #5c3d22, #7a5230);
      color: #f5e4c0;
      font-size: 13px;
      font-weight: 700;
      padding: 10px 18px;
      letter-spacing: .5px;
    }}
    .info-row {{
      display: flex;
      padding: 10px 18px;
      border-bottom: 1px solid #ead9c4;
      font-size: 13.5px;
    }}
    .info-row:last-child {{ border-bottom: none; }}
    .info-label {{
      color: #a08060;
      min-width: 110px;
      font-weight: 600;
    }}
    .info-value {{ color: #2a1a0e; font-weight: 700; flex: 1; }}
    .cta-btn {{
      display: block;
      background: linear-gradient(135deg, #5c3d22, #7a5230);
      color: #f5e4c0;
      text-decoration: none;
      text-align: center;
      border-radius: 10px;
      padding: 14px 24px;
      font-weight: 700;
      font-size: 14px;
      margin-bottom: 20px;
    }}
    .note {{ font-size: 12.5px; color: #a08060; line-height: 1.7; text-align: center; }}
    .footer {{
      background: #f5ede4;
      border: 1px solid #ead9c4;
      border-radius: 0 0 16px 16px;
      padding: 16px 28px;
      text-align: center;
      font-size: 12px;
      color: #a08060;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand">🎸 STRUMIFY</div>
      <div class="header-sub">Học viện Âm nhạc & Nhạc cụ</div>
    </div>

    <div class="body">
      <p class="greeting">Xin chào <strong>{student_name}</strong>,</p>
      <p class="subtitle">
        Chúc mừng bạn đã đăng ký thành công khóa học tại STRUMIFY!
        Dưới đây là thông tin của bạn. Vui lòng lưu lại để thuận tiện trong quá trình học.
      </p>

      <!-- Mã học viên -->
      <div class="student-code-box">
        <div class="student-code-label">Mã học viên của bạn</div>
        <div class="student-code">{student_code}</div>
      </div>

      <!-- Thông tin khóa học -->
      <div class="info-card">
        <div class="info-card-header">📋 Thông tin đăng ký</div>
        <div class="info-row">
          <span class="info-label">Học viên</span>
          <span class="info-value">{student_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Khóa học</span>
          <span class="info-value">{course_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Lớp học</span>
          <span class="info-value">{class_name}</span>
        </div>
        {schedule_row}
        {instructor_row}
      </div>

      <!-- CTA -->
      <a href="{base_url}/profile#enrollments" class="cta-btn">
        Xem lịch học & tài liệu →
      </a>

      <p class="note">
        Nếu có thắc mắc, hãy liên hệ chúng tôi qua
        <a href="mailto:info@strumify.vn" style="color:#c9922a">info@strumify.vn</a>
        hoặc hotline <strong>0944 024 055</strong>.
      </p>
    </div>

    <div class="footer">
      © 2026 STRUMIFY Instrument · 123 Lê Duẩn, Quận 1, TP.HCM<br>
      <a href="{base_url}/unsubscribe" style="color:#c9922a;text-decoration:none">Hủy đăng ký email</a>
    </div>
  </div>
</body>
</html>"""


# ── SEND FUNCTION ────────────────────────────────────────────────
async def send_enrollment_email(
    to_email:       str,
    student_name:   str,
    student_code:   str,
    course_name:    str,
    class_name:     str,
    schedule:       Optional[str] = None,
    instructor:     Optional[str] = None,
) -> bool:
    """
    Gửi email xác nhận đăng ký khóa học.
    Trả về True nếu gửi thành công.
    """
    mail_user = os.getenv("MAIL_USERNAME", "")
    mail_pass = os.getenv("MAIL_PASSWORD", "")
    mail_from = os.getenv("MAIL_FROM", mail_user)

    if not mail_user or not mail_pass:
        print(f"[EMAIL SKIP] Chưa cấu hình MAIL_USERNAME/MAIL_PASSWORD. To: {to_email}")
        return False

    try:
        from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

        config = ConnectionConfig(
            MAIL_USERNAME   = mail_user,
            MAIL_PASSWORD   = mail_pass,
            MAIL_FROM       = mail_from,
            MAIL_FROM_NAME  = "STRUMIFY Academy",
            MAIL_PORT       = int(os.getenv("MAIL_PORT", "587")),
            MAIL_SERVER     = os.getenv("MAIL_SERVER", "smtp.gmail.com"),
            MAIL_STARTTLS   = True,
            MAIL_SSL_TLS    = False,
            USE_CREDENTIALS = True,
        )

        html_body = build_enrollment_email(
            student_name  = student_name,
            student_code  = student_code,
            course_name   = course_name,
            class_name    = class_name,
            schedule      = schedule,
            instructor    = instructor,
        )

        message = MessageSchema(
            subject    = f"[STRUMIFY] Xác nhận đăng ký khóa học – Mã học viên {student_code}",
            recipients = [to_email],
            body       = html_body,
            subtype    = MessageType.html,
        )

        fm = FastMail(config)
        await fm.send_message(message)
        print(f"[EMAIL OK] Đã gửi đến {to_email} – Mã: {student_code}")
        return True

    except Exception as e:
        print(f"[EMAIL ERROR] {to_email}: {e}")
        return False