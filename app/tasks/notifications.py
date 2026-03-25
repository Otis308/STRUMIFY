# ================================================================
#  STRUMIFY – tasks/notifications.py
#  Celery tasks: Gửi Email & SMS bất đồng bộ
#
#  Setup nhanh:
#    pip install celery redis fastapi-mail
#    Chạy worker: celery -A tasks.notifications worker --loglevel=info
# ================================================================

from __future__ import annotations

import os
from typing import Optional

from celery import Celery

# ── Celery app ─────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "strumify_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Ho_Chi_Minh",
    enable_utc=True,
    task_track_started=True,
)

# ── Email config (dùng fastapi-mail) ───────────────────────────
try:
    from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

    MAIL_CONFIG = ConnectionConfig(
        MAIL_USERNAME   = os.getenv("MAIL_USERNAME", ""),
        MAIL_PASSWORD   = os.getenv("MAIL_PASSWORD", ""),
        MAIL_FROM       = os.getenv("MAIL_FROM", "noreply@strumify.vn"),
        MAIL_FROM_NAME  = "STRUMIFY Instrument",
        MAIL_PORT       = int(os.getenv("MAIL_PORT", "587")),
        MAIL_SERVER     = os.getenv("MAIL_SERVER", "smtp.gmail.com"),
        MAIL_STARTTLS   = True,
        MAIL_SSL_TLS    = False,
        USE_CREDENTIALS = True,
    )
    _mail_enabled = True
except ImportError:
    _mail_enabled = False

# ── SMS config (ví dụ: Twilio) ─────────────────────────────────
try:
    from twilio.rest import Client as TwilioClient

    _twilio = TwilioClient(
        os.getenv("TWILIO_ACCOUNT_SID", ""),
        os.getenv("TWILIO_AUTH_TOKEN",  ""),
    )
    TWILIO_FROM = os.getenv("TWILIO_FROM_NUMBER", "")
    _sms_enabled = True
except ImportError:
    _sms_enabled = False


# ──────────────────────────────────────────────────────────────
#  HELPER: HTML email templates (inline)
# ──────────────────────────────────────────────────────────────

def _booking_html(name: str, order_code: str, instrument: str) -> str:
    return f"""
    <div style="font-family:'Nunito',sans-serif;max-width:560px;margin:0 auto;
                background:#fff;border-radius:16px;overflow:hidden;
                box-shadow:0 4px 24px rgba(74,46,20,.12)">
      <div style="background:linear-gradient(135deg,#5c3d22,#7a5230);
                  padding:32px 28px;text-align:center">
        <h1 style="color:#f5e4c0;font-size:1.5rem;margin:0">🎸 STRUMIFY</h1>
        <p style="color:rgba(245,228,192,.75);margin:6px 0 0;font-size:13px">
          Dịch vụ Bảo dưỡng & Sửa chữa nhạc cụ
        </p>
      </div>
      <div style="padding:28px">
        <p style="font-size:15px;color:#2a1a0e">Xin chào <strong>{name}</strong>,</p>
        <p style="color:#6b4e35;line-height:1.7">
          Chúng tôi đã nhận được yêu cầu đặt lịch sửa chữa của bạn.
          Nhân viên sẽ liên hệ trong vòng <strong>2 giờ</strong> làm việc.
        </p>
        <div style="background:#fdf6ee;border:1px solid #ead9c4;border-radius:12px;
                    padding:18px 20px;margin:20px 0">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="color:#a08060;font-size:13px">Mã đơn</span>
            <strong style="color:#5c3d22;font-size:15px;letter-spacing:.06em">{order_code}</strong>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:#a08060;font-size:13px">Nhạc cụ</span>
            <strong style="color:#5c3d22;font-size:13px">{instrument}</strong>
          </div>
        </div>
        <p style="color:#6b4e35;font-size:13px;line-height:1.7">
          Lưu mã đơn bên trên để tra cứu trạng thái tại:<br>
          <a href="https://strumify.vn/repair#tracking" style="color:#c9922a">
            strumify.vn/repair#tracking
          </a>
        </p>
      </div>
      <div style="background:#f8f3ec;padding:16px 28px;text-align:center;
                  font-size:12px;color:#a08060;border-top:1px solid #ead9c4">
        © 2026 STRUMIFY Instrument · 123 Nguyễn Thị Minh Khai, Q.1, TP.HCM
      </div>
    </div>"""


def _status_update_html(
    name: str,
    order_code: str,
    old_status: str,
    new_status: str,
    note: Optional[str],
    estimated_cost: Optional[float],
) -> str:
    cost_block = ""
    if estimated_cost:
        cost_block = f"""
        <div style="background:#fdf6ee;border:2px solid #c9922a;border-radius:12px;
                    padding:14px 18px;margin:16px 0;text-align:center">
          <p style="margin:0;color:#a08060;font-size:12px">Chi phí dự kiến</p>
          <p style="margin:4px 0 0;font-size:1.5rem;font-weight:900;color:#c9922a">
            {int(estimated_cost):,}₫
          </p>
          <p style="margin:6px 0 0;font-size:12px;color:#6b4e35">
            Vui lòng xác nhận qua link trong email để chúng tôi tiến hành sửa.
          </p>
        </div>"""

    note_block = f'<p style="color:#6b4e35;font-size:13px;line-height:1.7"><strong>Ghi chú:</strong> {note}</p>' if note else ""

    return f"""
    <div style="font-family:'Nunito',sans-serif;max-width:560px;margin:0 auto;
                background:#fff;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#5c3d22,#7a5230);
                  padding:28px;text-align:center">
        <h1 style="color:#f5e4c0;font-size:1.4rem;margin:0">Cập nhật đơn sửa chữa</h1>
        <p style="color:rgba(245,228,192,.7);margin:4px 0 0;font-size:12px">
          Mã đơn: <strong style="color:#e8c060">{order_code}</strong>
        </p>
      </div>
      <div style="padding:24px 28px">
        <p style="font-size:14px;color:#2a1a0e">Xin chào <strong>{name}</strong>,</p>
        <p style="color:#6b4e35;line-height:1.6">
          Đơn sửa chữa của bạn vừa được cập nhật trạng thái:
        </p>
        <div style="display:flex;align-items:center;gap:12px;margin:16px 0">
          <span style="background:#ead9c4;color:#7a5230;padding:6px 14px;
                       border-radius:50px;font-size:12px;font-weight:700">
            {old_status}
          </span>
          <span style="color:#c9922a;font-size:18px">→</span>
          <span style="background:#5c3d22;color:#f5e4c0;padding:6px 14px;
                       border-radius:50px;font-size:12px;font-weight:700">
            {new_status}
          </span>
        </div>
        {note_block}
        {cost_block}
        <a href="https://strumify.vn/repair#tracking"
           style="display:inline-block;margin-top:10px;padding:12px 24px;
                  background:linear-gradient(135deg,#5c3d22,#7a5230);
                  color:#f5e4c0;border-radius:10px;text-decoration:none;
                  font-weight:700;font-size:14px">
          Xem chi tiết đơn hàng →
        </a>
      </div>
    </div>"""


# ──────────────────────────────────────────────────────────────
#  CELERY TASKS
# ──────────────────────────────────────────────────────────────

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_booking_confirmation(
    self,
    email: Optional[str],
    name: str,
    order_code: str,
    instrument: str,
):
    """
    Gửi email xác nhận đặt lịch.
    Retry tự động 3 lần nếu thất bại.
    """
    if not email or not _mail_enabled:
        return {"skipped": True, "reason": "no_email_or_config"}

    try:
        import asyncio

        async def _send():
            fm = FastMail(MAIL_CONFIG)
            msg = MessageSchema(
                subject=f"[STRUMIFY] Xác nhận đặt lịch – {order_code}",
                recipients=[email],
                body=_booking_html(name, order_code, instrument),
                subtype=MessageType.html,
            )
            await fm.send_message(msg)

        asyncio.run(_send())
        return {"sent": True, "to": email}

    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_status_update_notification(
    self,
    email: Optional[str],
    phone: Optional[str],
    name: str,
    order_code: str,
    old_status: str,
    new_status: str,
    note: Optional[str] = None,
    estimated_cost: Optional[float] = None,
):
    """
    Gửi Email + SMS khi trạng thái đơn thay đổi.
    Chạy bất đồng bộ, không block API response.
    """
    results = {}

    # ── Email ──
    if email and _mail_enabled:
        try:
            import asyncio

            async def _send_email():
                fm = FastMail(MAIL_CONFIG)
                msg = MessageSchema(
                    subject=f"[STRUMIFY] Đơn {order_code} – {new_status}",
                    recipients=[email],
                    body=_status_update_html(name, order_code, old_status, new_status, note, estimated_cost),
                    subtype=MessageType.html,
                )
                await fm.send_message(msg)

            asyncio.run(_send_email())
            results["email"] = "sent"
        except Exception as exc:
            results["email"] = f"error: {exc}"

    # ── SMS (Twilio) ──
    if phone and _sms_enabled and TWILIO_FROM:
        try:
            sms_body = (
                f"[STRUMIFY] Đơn {order_code}: {old_status} → {new_status}."
                + (f" {note}" if note else "")
                + " Chi tiết: strumify.vn/repair"
            )
            _twilio.messages.create(
                body=sms_body,
                from_=TWILIO_FROM,
                to=phone if phone.startswith("+") else f"+84{phone[1:]}",
            )
            results["sms"] = "sent"
        except Exception as exc:
            results["sms"] = f"error: {exc}"

    return results