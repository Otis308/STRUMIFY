"""
routers/rout_view.py – Strumify  (Page rendering)

FIX: order_page() was calling templates.TemplateResponse("order.html", {...})
     WITHOUT including a 'products' key in the context dict.
     Jinja2 then crashed at line 174 of order.html with:
       UndefinedError: 'product' is undefined
     
     Root cause: the template loops over products and accesses product.id,
     product.name, etc. — but the view function never fetched or passed them.

     Fix: fetch all active products from Supabase, normalize image fields,
     and pass them as 'products' in the template context.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Request, Query
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from src.shared.supabase_client import supabase
import json

router    = APIRouter()
templates = Jinja2Templates(directory="src/interfaces/web/templates")


# ── HELPERS ───────────────────────────────────────────────────────
def _normalize_product(p: dict) -> dict:
    """Chuẩn hóa ảnh và loại bỏ giá trị None/string trước khi render."""
    def clean(v):
        if v is None: return None
        if isinstance(v, str) and v.strip().lower() in ('none', 'null', ''): return None
        return v

    p["image_url"] = clean(p.get("image_url")) or clean(p.get("img")) or None
    p["price"]     = float(p["price"])  if p.get("price")   is not None else 0
    p["orig"]      = float(p["orig"])   if p.get("orig")     is not None else None
    p["rating"]    = float(p["rating"]) if p.get("rating")   is not None else None
    p["reviews"]   = int(p["reviews"])  if p.get("reviews")  is not None else 0
    for key in ("name", "description", "cat", "brand", "badge"):
        p[key] = clean(p.get(key))
    return p


def _fetch_products(
    cat:       Optional[str] = None,
    search:    Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
) -> list[dict]:
    """Lấy sản phẩm từ Supabase với filter tuỳ chọn."""
    try:
        query = supabase.table("products").select(
            "id, name, description, cat, brand, badge, "
            "price, orig, image_url, img, rating, reviews, specs"
        )

        if cat:       query = query.eq("cat", cat)  
        if search:    query = query.ilike("name", f"%{search}%")
        if min_price: query = query.gte("price", min_price)
        if max_price: query = query.lte("price", max_price)

        res = query.order("id").limit(500).execute()
        return [_normalize_product(p) for p in (res.data or [])]
    except Exception as e:
        print(f"[rout_view] Lỗi fetch products: {e}")
        return []

def clean(value, fallback=""):
    """Chuyển Python None / string 'None' thành fallback."""
    if value is None:
        return fallback
    if isinstance(value, str) and value.strip().lower() in ("none", "null", ""):
        return fallback
    return str(value).strip() if isinstance(value, str) else value

def normalize_product(p: dict) -> dict:
    """Clean & normalize product data từ Supabase."""
    # Parse specs nếu là string JSON
    specs = p.get("specs")
    if isinstance(specs, str):
        try:
            specs = json.loads(specs)
        except:
            specs = {}
    
    return {
        "id":          p.get("id"),
        "name":        clean(p.get("name"), "Sản phẩm"),
        "description": clean(p.get("description"), ""),
        "category":    clean(p.get("cat") or p.get("category"), "Khác"),
        "cat":         clean(p.get("cat") or p.get("category"), "Khác"),
        "brand":       clean(p.get("brand"), ""),
        "badge":       clean(p.get("badge"), ""),
        "price":       float(p.get("price") or 0),
        "orig":        float(p.get("orig") or 0),
        # Ưu tiên image_url, fallback sang img
        "image_url":   clean(p.get("image_url")) or clean(p.get("img")) or "",
        "img":         clean(p.get("img")) or clean(p.get("image_url")) or "",
        "rating":      float(p.get("rating") or 0),
        "reviews":     int(p.get("reviews") or 0),
        "specs":       specs or {},
    }


# ── TRANG CHỦ ─────────────────────────────────────────────────────
@router.get("/", response_class=HTMLResponse)
async def home_page(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})

# ── TRANG ĐẶT HÀNG - SẢN PHẨM ─────────────────────────────────────
# Trong file rout_view.py
@router.get("/order", name="order_page", response_class=HTMLResponse)
async def order_page(request: Request):
    try:
        # Lấy dữ liệu từ Supabase
        res = supabase.table("products").select("*").execute()
        # Chuẩn hóa dữ liệu ảnh và lọc giá trị rỗng
        products_normalized = [_normalize_product(p) for p in (res.data or [])]
        
        return templates.TemplateResponse("order.html", {
            "request": request,
            "products": products_normalized  # Đặt tên biến là "products" (số nhiều)
        })
    except Exception as e:
        # Trường hợp lỗi, trả về danh sách rỗng để tránh sập trang
        return templates.TemplateResponse("order.html", {
            "request": request, 
            "products": []
        })

# ── TRANG GIỎ HÀNG / CHECKOUT ─────────────────────────────────────
@router.get("/cart", response_class=HTMLResponse)
async def cart_page(request: Request):
    return templates.TemplateResponse("cart.html", {"request": request})


# ── TRANG PROFILE ──────────────────────────────────────────────────
@router.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request):
    return templates.TemplateResponse("profile.html", {"request": request})


# ── TRANG ĐĂNG NHẬP ───────────────────────────────────────────────
@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("register&login.html", {"request": request})
# ─────────────────────────────────────────────────

# ── TRANG KHÓA HỌC ────────────────────────────────────────────────
@router.get("/courses", response_class=HTMLResponse, name="course")
async def course_page(request: Request):
    return templates.TemplateResponse("courses.html", {"request": request})


# ── TRANG SỬA CHỮA ────────────────────────────────────────────────
@router.get("/repair", response_class=HTMLResponse, name="repair")
async def repair_page(request: Request):
    return templates.TemplateResponse("repair.html", {"request": request})
# ─────────────────────────────────────────────────

# ── TRANG ADMIN ───────────────────────────────────────────────────
@router.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})
# ─────────────────────────────────────────────────
