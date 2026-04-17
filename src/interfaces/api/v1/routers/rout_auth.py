"""
app/routers/auth.py – Strumify
Register / Login / Forgot-Password / Reset-Password / Profile

Đây là file DUY NHẤT xử lý auth. Không còn register.py riêng.
"""
import os
import secrets
import hashlib
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, EmailStr, field_validator

from src.shared.supabase_client import supabase
from src.shared.security import (
    hash_password, verify_password, create_token, get_current_user
)
from src.shared.security import verify_password, create_token

router = APIRouter(prefix="/auth", tags=["Auth"])

ADMIN_EMAILS: set[str] = set(
    e.strip().lower()
    for e in os.getenv("ADMIN_EMAILS", "admin@strumify.vn").split(",")
    if e.strip()
)
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:8000")

# ── MEMBERSHIP ───────────────────────────────────────────────────
def calc_tier(order_count: int, total_spent: int) -> str:
    if order_count >= 75 or total_spent >= 15_000_000:
        return "diamond"
    if order_count >= 20 or total_spent >= 5_000_000:
        return "gold"
    if order_count >= 3 or total_spent >= 1_000_000:
        return "silver"
    return "new"

TIER_INFO = {
    "new":     {"label": "Thành viên Mới",       "icon": "fa-seedling", "color": "#8a6f55"},
    "silver":  {"label": "Thành viên Bạc",        "icon": "fa-medal",    "color": "#94a3b8"},
    "gold":    {"label": "Thành viên Vàng",       "icon": "fa-crown",    "color": "#c9922a"},
    "diamond": {"label": "Thành viên Kim Cương",  "icon": "fa-gem",      "color": "#7c3aed"},
}

# ── SCHEMAS ──────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username: str
    email:    EmailStr
    password: str
    phone:    Optional[str] = None
    dob:      Optional[str] = None   # YYYY-MM-DD
    gender:   Optional[str] = None
    address:  Optional[str] = None
    role:     str = "customer"

    @field_validator("username")
    @classmethod
    def check_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError("Họ tên phải có ít nhất 2 ký tự")
        return v.strip()

    @field_validator("password")
    @classmethod
    def check_pw(cls, v):
        if not re.search(r"(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}", v):
            raise ValueError("Mật khẩu cần ≥8 ký tự, chữ hoa, thường, số và ký tự đặc biệt")
        return v

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    phone:    Optional[str] = None
    address:  Optional[str] = None
    dob:      Optional[str] = None
    gender:   Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token:        str
    new_password: str


# ── ĐĂNG KÝ ──────────────────────────────────────────────────────
@router.post("/register", status_code=201)
async def register(body: RegisterRequest):
    email    = body.email.lower().strip()
    username = body.username.strip()

    # Kiểm tra email trùng
    dup_email = supabase.table("users").select("id").eq("email", email).execute()
    if dup_email.data:
        raise HTTPException(400, detail="Email này đã được đăng ký.")

    # Kiểm tra username trùng
    dup_name = supabase.table("users").select("id").eq("username", username).execute()
    if dup_name.data:
        raise HTTPException(400, detail="Tên đăng nhập đã tồn tại.")

    new_user = {
        "username":        username,
        "email":           email,
        "password_hash":   hash_password(body.password),
        "phone":           body.phone   or None,
        "dob":             body.dob     or None,
        "gender":          body.gender  or None,
        "address":         body.address or None,
        "role":            "customer",   # Không bao giờ cho phép đăng ký thành admin
        "membership_tier": "new",
        "order_count":     0,
        "total_spent":     0,
    }

    res = supabase.table("users").insert(new_user).execute()
    if not res.data:
        raise HTTPException(500, detail="Không thể tạo tài khoản. Vui lòng thử lại.")

    u = res.data[0]
    return {
        "status":  "success",
        "message": "Đăng ký thành công!",
        "user":    {"id": u["id"], "email": u["email"], "username": u["username"]},
    }


# ── ĐĂNG NHẬP ────────────────────────────────────────────────────
@router.post("/login")
async def login(body: LoginRequest):
    email = body.email.lower().strip()
    res   = supabase.table("users").select(
        "id, username, email, password_hash, phone, dob, gender, address, "
        "role, avatar_url, membership_tier, order_count, total_spent"
    ).eq("email", email).maybe_single().execute()

    u = res.data
    if not u or not verify_password(body.password, u["password_hash"]):
        raise HTTPException(401, detail="Email hoặc mật khẩu không đúng.")

    # Admin email override
    role = "admin" if email in ADMIN_EMAILS else (u.get("role") or "customer")
    tier = u.get("membership_tier") or calc_tier(
        u.get("order_count", 0), u.get("total_spent", 0)
    )

    token = create_token({
        "sub":      str(u["id"]),
        "email":    email,
        "username": u["username"],
        "role":     role,
    })

    return {
        "access_token": token,
        "token_type":   "bearer",
        "role":         role,
        "user": {
            "id":              u["id"],
            "email":           u["email"],
            "username":        u["username"],
            "phone":           u.get("phone")      or "",
            "dob":             u.get("dob")        or "",
            "gender":          u.get("gender")     or "",
            "address":         u.get("address")    or "",
            "avatar_url":      u.get("avatar_url") or "",
            "role":            role,
            "membership_tier": tier,
            "order_count":     u.get("order_count", 0),
            "total_spent":     u.get("total_spent",  0),
            "tier_info":       TIER_INFO.get(tier, TIER_INFO["new"]),
        },
    }


# ── THÔNG TIN CÁ NHÂN ─────────────────────────────────────────────
@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    tier = current_user.get("membership_tier") or calc_tier(
        current_user.get("order_count", 0), current_user.get("total_spent", 0)
    )
    return {
        "user": {
            **current_user,
            "tier_info": TIER_INFO.get(tier, TIER_INFO["new"]),
        }
    }


# ── CẬP NHẬT PROFILE ─────────────────────────────────────────────
@router.put("/me")
async def update_profile(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"message": "Không có gì thay đổi."}

    res = supabase.table("users").update(updates).eq("id", current_user["id"]).execute()
    if not res.data:
        raise HTTPException(500, detail="Không thể cập nhật thông tin.")
    return {"status": "success", "message": "Đã lưu thông tin.", "user": res.data[0]}


# ── QUÊN MẬT KHẨU ────────────────────────────────────────────────
@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, bg: BackgroundTasks):
    email = body.email.lower().strip()
    res   = supabase.table("users").select("id,email,username").eq("email", email).maybe_single().execute()

    # Luôn trả 200 để không lộ email nào tồn tại
    if not res.data:
        return {"message": "Nếu email tồn tại, link đặt lại đã được gửi."}

    u           = res.data
    raw_token   = secrets.token_urlsafe(32)
    token_hash  = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at  = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()

    supabase.table("password_resets").upsert({
        "user_id":    u["id"],
        "token_hash": token_hash,
        "expires_at": expires_at,
        "used":       False,
    }).execute()

    reset_link = f"{APP_BASE_URL}/login?reset_token={raw_token}"

    async def _send_email():
        print(f"[DEV] Reset link cho {email}: {reset_link}")
        try:
            import os
            mail_user = os.getenv("MAIL_USERNAME", "")
            mail_pass = os.getenv("MAIL_PASSWORD", "")
            mail_from = os.getenv("MAIL_FROM", "")
            if not mail_user:
                return  # Skip nếu chưa cấu hình email

            from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
            cfg = ConnectionConfig(
                MAIL_USERNAME=mail_user, MAIL_PASSWORD=mail_pass,
                MAIL_FROM=mail_from, MAIL_PORT=587,
                MAIL_SERVER="smtp.gmail.com",
                MAIL_STARTTLS=True, MAIL_SSL_TLS=False, USE_CREDENTIALS=True,
            )
            html = f"""
<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;
            background:#fdf7f0;border-radius:16px">
  <h2 style="color:#5c3d22;font-family:Georgia,serif">STRUMIFY 🎸</h2>
  <p>Xin chào <strong>{u['username']}</strong>,</p>
  <p>Nhấn nút bên dưới để đặt lại mật khẩu. Link hết hạn sau <strong>15 phút</strong>.</p>
  <a href="{reset_link}"
     style="display:inline-block;margin:20px 0;padding:13px 28px;
            background:#7a5230;color:#f5e4c0;border-radius:10px;
            text-decoration:none;font-weight:bold">
    Đặt lại mật khẩu
  </a>
  <p style="color:#8a6f55;font-size:13px">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
</div>"""
            msg = MessageSchema(
                subject="STRUMIFY – Đặt lại mật khẩu",
                recipients=[email],
                body=html,
                subtype=MessageType.html,
            )
            await FastMail(cfg).send_message(msg)
        except Exception as e:
            print(f"[Email Error] {e}")

    bg.add_task(_send_email)
    return {"message": "Nếu email tồn tại, link đặt lại đã được gửi."}


# ── ĐẶT LẠI MẬT KHẨU ─────────────────────────────────────────────
@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    if not re.search(r"(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}", body.new_password):
        raise HTTPException(400, detail="Mật khẩu không đủ mạnh.")

    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    res = supabase.table("password_resets").select("*") \
        .eq("token_hash", token_hash).eq("used", False).maybe_single().execute()
    rec = res.data

    if not rec:
        raise HTTPException(400, detail="Token không hợp lệ hoặc đã được sử dụng.")
    if datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(400, detail="Token đã hết hạn. Vui lòng yêu cầu lại.")

    supabase.table("users") \
        .update({"password_hash": hash_password(body.new_password)}) \
        .eq("id", rec["user_id"]).execute()

    supabase.table("password_resets") \
        .update({"used": True}) \
        .eq("token_hash", token_hash).execute()

    return {"status": "success", "message": "Đặt lại mật khẩu thành công!"}