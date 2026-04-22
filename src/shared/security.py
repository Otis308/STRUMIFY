# src/shared/security.py

"""
Security - Password hashing với Argon2 (OWASP recommended)
"""
import os
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import jwt, JWTError

from src.shared.supabase_client import supabase

# ── CONFIG ────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "")
if not JWT_SECRET:
    raise RuntimeError("❌ Thiếu JWT_SECRET trong .env")

JWT_ALG    = "HS256"
TOKEN_DAYS = 7

# ── PASSWORD - Argon2 (OWASP Recommended) ─────────────────────────
# ✅ Argon2 không có giới hạn 72 bytes
# ✅ An toàn hơn BCrypt
pwd_ctx = CryptContext(
    schemes=["argon2"],
    deprecated="auto"
)

def hash_password(plain: str) -> str:
    """Hash password dùng Argon2 - không giới hạn độ dài"""
    if not plain:
        return ""
    try:
        return pwd_ctx.hash(plain)
    except Exception as e:
        print(f"❌ Lỗi hash password: {e}")
        raise

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password"""
    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_ctx.verify(plain_password, hashed_password)
    except Exception as e:
        print(f"❌ Lỗi verify password: {e}")
        return False

def get_password_hash(password: str) -> str:
    """Alias"""
    return hash_password(password)

# ── JWT ───────────────────────────────────────────────────────────
def create_token(payload: dict) -> str:
    data = payload.copy()
    data["exp"] = datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALG)

def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])

# ── DEPENDENCY ────────────────────────────────────────────────────
bearer = HTTPBearer(auto_error=False)

async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Chưa đăng nhập.")
    try:
        payload = decode_token(creds.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn.")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token không hợp lệ.")

    res = supabase.table("users").select(
        "id, username, email, phone, address, dob, gender, "
        "role, avatar_url, membership_tier, order_count, total_spent"
    ).eq("id", user_id).maybe_single().execute()

    if not res.data:
        raise HTTPException(status_code=401, detail="Tài khoản không tồn tại.")

    return res.data

async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Bạn không có quyền admin.")
    return current_user