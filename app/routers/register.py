"""
MỘC – auth.py  (FIXED: lưu đúng vào Supabase, trả về đủ dữ liệu user)

pip install supabase python-jose[cryptography] passlib[bcrypt]

.env:
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY=eyJhbGci...   ← service_role key
    JWT_SECRET=random-32-chars
"""

import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, field_validator
from passlib.context import CryptContext
from jose import jwt, JWTError
from supabase import create_client, Client

# ── SUPABASE ─────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY trong .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── SECURITY ─────────────────────────────────────────────────────
pwd_ctx    = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = os.getenv("JWT_SECRET", "changeme-please-set-in-env-min-32-chars")
JWT_ALG    = "HS256"
TOKEN_DAYS = 7

def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_token(payload: dict) -> str:
    data = payload.copy()
    data["exp"] = datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALG)

def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])

# ── DEPENDENCY: lấy user hiện tại từ JWT ────────────────────────
bearer = HTTPBearer(auto_error=False)

async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer)
) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Chưa đăng nhập.")
    try:
        payload = decode_token(creds.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn.")

    user_id = payload.get("sub")
    result  = supabase.table("users").select(
        "id, username, email, phone, address, role, avatar_url"
    ).eq("id", user_id).maybe_single().execute()

    if not result.data:
        raise HTTPException(status_code=401, detail="Tài khoản không tồn tại.")
    return result.data

# ── ROUTER ───────────────────────────────────────────────────────
router = APIRouter(prefix="/auth", tags=["auth"])

# ── SCHEMAS ──────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    phone: str | None = None
    role: str = "customer"

    @field_validator("username")
    @classmethod
    def check_username(cls, v):
        if len(v.strip()) < 2:
            raise ValueError("Họ tên phải có ít nhất 2 ký tự")
        return v.strip()

    @field_validator("password")
    @classmethod
    def check_password(cls, v):
        import re
        if not re.search(r"(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}", v):
            raise ValueError("Mật khẩu cần ≥8 ký tự, có chữ hoa, thường, số và ký tự đặc biệt")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    username: str | None = None
    phone:    str | None = None
    address:  str | None = None


# ── ĐĂNG KÝ ──────────────────────────────────────────────────────
@router.post("/register", status_code=201)
async def register(body: RegisterRequest):
    email = body.email.lower().strip()

    # Kiểm tra email trùng
    dup = supabase.table("users").select("id").eq("email", email).maybe_single().execute()
    if dup.data:
        raise HTTPException(400, detail="Email này đã được đăng ký.")

    # Kiểm tra username trùng
    dup2 = supabase.table("users").select("id").eq("username", body.username).maybe_single().execute()
    if dup2.data:
        raise HTTPException(400, detail="Tên đăng nhập đã tồn tại.")

    # Insert vào Supabase
    new_user = {
        "username":      body.username,
        "email":         email,
        "password_hash": hash_password(body.password),
        "phone":         body.phone or None,
        "role":          body.role if body.role in ("customer", "admin") else "customer",
    }

    res = supabase.table("users").insert(new_user).execute()
    if not res.data:
        raise HTTPException(500, detail="Không thể tạo tài khoản. Thử lại sau.")

    user = res.data[0]
    return {
        "status":  "success",
        "message": "Đăng ký thành công!",
        "user": {
            "id":       user["id"],
            "email":    user["email"],
            "username": user["username"],
        }
    }


# ── ĐĂNG NHẬP ─────────────────────────────────────────────────────
ADMIN_EMAILS = {"admin@mocguitar.vn"}

@router.post("/login")
async def login(body: LoginRequest):
    email = body.email.lower().strip()

    # Lấy user từ Supabase
    res = supabase.table("users").select(
        "id, username, email, password_hash, phone, address, role, avatar_url"
    ).eq("email", email).maybe_single().execute()

    user = res.data
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, detail="Email hoặc mật khẩu không đúng.")

    # Xác định role
    role = user.get("role") or ("admin" if email in ADMIN_EMAILS else "customer")

    # Tạo JWT
    token = create_token({
        "sub":      str(user["id"]),
        "email":    email,
        "username": user["username"],
        "role":     role,
    })

    return {
        "access_token": token,
        "token_type":   "bearer",
        "role":         role,
        "user": {
            "id":         user["id"],
            "email":      user["email"],
            "username":   user["username"],
            "phone":      user.get("phone") or "",
            "address":    user.get("address") or "",
            "avatar_url": user.get("avatar_url") or "",
            "role":       role,
        },
    }


# ── LẤY THÔNG TIN CÁ NHÂN ────────────────────────────────────────
@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}


# ── CẬP NHẬT PROFILE ─────────────────────────────────────────────
@router.put("/me")
async def update_profile(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user)
):
    updates = {}
    if body.username is not None: updates["username"] = body.username
    if body.phone    is not None: updates["phone"]    = body.phone
    if body.address  is not None: updates["address"]  = body.address

    if not updates:
        return {"message": "Không có gì thay đổi."}

    res = supabase.table("users").update(updates).eq("id", current_user["id"]).execute()
    if not res.data:
        raise HTTPException(500, detail="Không thể cập nhật thông tin.")

    return {"status": "success", "message": "Đã lưu thông tin.", "user": res.data[0]}