import uvicorn
from fastapi import FastAPI, Request, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# ── Import Database & Models (Dùng cho trang /order) ───────────
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database.database import get_db
from app.models.mod_product import Product

# ── Import routers (Đã sửa tên cho khớp với file của bạn) ──────
from app.routers.rout_auth    import router as auth_router
from app.routers.rout_product import router as product_router
from app.routers.rout_order   import router as orders_router
from app.routers.rout_view    import router as view_router

# ── App Init & Middleware ──────────────────────────────────────
app = FastAPI(title="Strumify API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files & Templates ───────────────────────────────────
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# ── Đăng ký routers ────────────────────────────────────────────
app.include_router(auth_router,    prefix="/auth",     tags=["Auth"])
app.include_router(product_router, prefix="/products", tags=["Products"])
app.include_router(orders_router,                      tags=["Orders"])
app.include_router(view_router,                        tags=["Pages"])

# ── Misc routes ────────────────────────────────────────────────
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

# ── Giao diện Web (Views) ──────────────────────────────────────
@app.get("/")
async def home_page(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})

@app.get("/login")
async def login_page(request: Request):
    return templates.TemplateResponse("register&login.html", {"request": request})

@app.get("/profile")
async def profile_page(request: Request): # Đã fix lỗi trùng tên hàm
    return templates.TemplateResponse("profile.html", {"request": request})

@app.get("/cart")
async def cart_page(request: Request):    # Đã fix lỗi trùng tên hàm
    return templates.TemplateResponse("cart.html", {"request": request})

@app.get("/order", name="order_page") 
async def order_page(request: Request, db: AsyncSession = Depends(get_db)):
    query = select(Product)
    result = await db.execute(query)
    guitars = result.scalars().all() 
    return templates.TemplateResponse("order.html", {
        "request": request, 
        "guitars": guitars 
    })

@app.get("/admin")
async def admin_page(request: Request):   # Đã fix lỗi trùng tên hàm
    return templates.TemplateResponse("admin.html", {"request": request})

@app.get("/courses", name="course")
async def courses_page(request: Request):
    return templates.TemplateResponse("courses.html", {"request": request})

@app.get("/repair", name="repair")
async def repair_page(request: Request):
    return templates.TemplateResponse("repair.html", {"request": request})

# ── Khởi chạy Server ───────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)