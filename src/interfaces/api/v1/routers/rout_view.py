
from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pathlib import Path
from src.shared.supabase_client import supabase
from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from src.infrastructure.database.database import get_db
from src.infrastructure.database.models.product import Product 

router = APIRouter()
templates = Jinja2Templates(directory="src/interfaces/web/templates")

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent.parent
TEMPLATE_DIR = BASE_DIR / "src" / "interfaces" / "web" / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

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
        "category":    clean(p.get("cat"),         ""),  
        "cat":         clean(p.get("cat"),         ""),
        "brand":       clean(p.get("brand"),       ""),
        "badge":       clean(p.get("badge"),       ""),
        "price":       float(p["price"]) if p.get("price") is not None else 0,
        "orig":        float(p["orig"])  if p.get("orig")  is not None else 0,
        "image_url":   clean(p.get("image_url")) or clean(p.get("img")) or "",
        "rating":      float(p["rating"])  if p.get("rating")  is not None else 0,
        "reviews":     int(p["reviews"])   if p.get("reviews") is not None else 0,
        "specs":       p.get("specs") or {},
    }


# ── TRANG CHỦ ─────────────────────────────────────────────────────
@router.get("/", response_class=HTMLResponse)
async def home_page(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})

# ── TRANG ĐĂNG NHẬP ───────────────────────────────────────────────
@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("register&login.html", {"request": request})


# ── TRANG PROFILE ─────────────────────────────────────────────────
@router.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request):
    return templates.TemplateResponse("profile.html", {"request": request})

# ── TRANG GIỎ HÀNG ────────────────────────────────────────────────
@router.get("/cart", response_class=HTMLResponse)
async def cart_page(request: Request):
    return templates.TemplateResponse("cart.html", {"request": request})


# ── TRANG ĐẶT HÀNG - SẢN PHẨM ─────────────────────────────────────
@router.get("/order", name="order_page", response_class=HTMLResponse)
async def order_page(request: Request, db: AsyncSession = Depends(get_db)):
    query = select(Product)
    result = await db.execute(query)
    guitars = result.scalars().all() 
    return templates.TemplateResponse("order.html", {
        "request": request, 
        "guitars": guitars 
    })


# ── TRANG KHÓA HỌC ────────────────────────────────────────────────
@router.get("/courses", name="course", response_class=HTMLResponse)
async def courses_page(request: Request):
    return templates.TemplateResponse("courses.html", {"request": request})


# ── TRANG SỬA CHỮA ────────────────────────────────────────────────
@router.get("/repair", name="repair", response_class=HTMLResponse)
async def repair_page(request: Request):
    return templates.TemplateResponse("repair.html", {"request": request})


# ── TRANG ADMIN ───────────────────────────────────────────────────
@router.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})


