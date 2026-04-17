"""
app/core/security.py
JWT + bcrypt password hashing + FastAPI dependency get_current_user
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
    raise RuntimeError("❌ Thiếu JWT_SECRET trong .env (cần ít nhất 32 ký tự ngẫu nhiên)")

JWT_ALG    = "HS256"
TOKEN_DAYS = 7

# ── PASSWORD ──────────────────────────────────────────────────────
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_ctx.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_ctx.hash(password)

# ── JWT ───────────────────────────────────────────────────────────
def create_token(payload: dict) -> str:
    data = payload.copy()
    data["exp"] = datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALG)

def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])

# ── DEPENDENCY: lấy user từ JWT Bearer token ─────────────────────
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

# ── LOGIN USER ─────────────────────
def login_user(email_nhap_vao: str, password_nhap_vao: str):
    
    # 1. TÌM USER TRONG DATABASE BẰNG EMAIL
    response = supabase.table("users").select("*").eq("email", email_nhap_vao).execute()
    users_list = response.data
    
    if not users_list:
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
        
    user = users_list[0] 
    
    # 2. KIỂM TRA MẬT KHẨU
    # Lấy cái password_hash từ database ra
    db_password_hash = user.get("password_hash")
    
    # Bỏ vào máy quét để so sánh
    is_correct = verify_password(password_nhap_vao, db_password_hash)
    
    if not is_correct:
        # Mật khẩu sai
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
        
    # Tiến hành tạo Token hoặc trả về thông tin user
    return {"message": "Đăng nhập thành công!", "user_id": user.get("id")}