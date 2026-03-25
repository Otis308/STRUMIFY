"""
app/routers/views.py – Strumify
✅ Fix: truyền products từ Supabase vào order.html template
✅ Fix: clean None values trước khi truyền vào Jinja2
"""
from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

from app.core.supabase_client import supabase

router    = APIRouter(tags=["Pages"])
templates = Jinja2Templates(directory="app/templates")


def clean(value, fallback=""):
    """Chuyển Python None / string 'None' thành fallback."""
    if value is None:
        return fallback
    if isinstance(value, str) and value.strip().lower() in ("none", "null", ""):
        return fallback
    return value


def normalize_product(p: dict) -> dict:
    """Clean product data trước khi truyền vào Jinja2 template."""
    return {
        "id":          p.get("id"),
        "name":        clean(p.get("name"),        "Sản phẩm"),
        "description": clean(p.get("description"), ""),
        "category":    clean(p.get("cat"),         ""),   # template dùng guitar.category
        "cat":         clean(p.get("cat"),         ""),
        "brand":       clean(p.get("brand"),       ""),
        "badge":       clean(p.get("badge"),       ""),
        "price":       float(p["price"]) if p.get("price") is not None else 0,
        "orig":        float(p["orig"])  if p.get("orig")  is not None else 0,
        # ✅ image_url ưu tiên trước img, không dùng default-guitar.jpg nữa
        "image_url":   clean(p.get("image_url")) or clean(p.get("img")) or "",
        "rating":      float(p["rating"])  if p.get("rating")  is not None else 0,
        "reviews":     int(p["reviews"])   if p.get("reviews") is not None else 0,
        "specs":       p.get("specs") or {},
    }


# ── TRANG CHỦ ─────────────────────────────────────────────────────
@router.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})


# ── TRANG SẢN PHẨM ───────────────────────────────────────────────
@router.get("/order", response_class=HTMLResponse)
async def order_page(request: Request):
    try:
        res = supabase.table("products").select(
            "id, name, description, cat, brand, badge, "
            "price, orig, image_url, img, rating, reviews, specs"
        ).order("id").execute()

        guitars = [normalize_product(p) for p in (res.data or [])]
    except Exception as e:
        print(f"[view.py] Lỗi tải sản phẩm: {e}")
        guitars = []

    return templates.TemplateResponse("order.html", {
        "request": request,
        "guitars": guitars,
    })


# ── TRANG ĐĂNG NHẬP ──────────────────────────────────────────────
@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("register&login.html", {"request": request})


# ── TRANG PROFILE ─────────────────────────────────────────────────
@router.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request):
    return templates.TemplateResponse("profile.html", {"request": request})


# ── TRANG ADMIN ───────────────────────────────────────────────────
@router.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})