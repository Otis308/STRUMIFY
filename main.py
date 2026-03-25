import uvicorn
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from contextlib import asynccontextmanager

from app.models.user import User
from app.models.order import Order

# Import các thành phần nội bộ
from app.database.database import engine, Base
from app.routers import product, auth 
from app.routers.auth  import router as auth_router
from app.routers.order import router as orders_router

from app.routers.auth import router as auth_router

from sqlalchemy.future import select
from app.models.product import Product
from app.database.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

# 1. Quản lý vòng đời ứng dụng (Lifespan)

app = FastAPI(title="Strumify API")

# --- ĐOẠN CODE CẤP PHÉP CORS BẮT BUỘC PHẢI CÓ ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Cấu hình Static và Templates
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# 3. Đăng ký các Router
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(product.router, prefix="/products", tags=["Products"])
app.include_router(auth_router)      
app.include_router(orders_router) 

# 4. Các Route giao diện (Views)
@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})

@app.get("/login")
async def login_page(request: Request):
    return templates.TemplateResponse("register&login.html", {"request": request})

@app.get("/profile")
async def login_page(request: Request):
    return templates.TemplateResponse("profile.html", {"request": request})

@app.get("/cart")
async def login_page(request: Request):
    return templates.TemplateResponse("cart.html", {"request": request})

@app.get("/order", name="order_page") 
async def order_page_function(request: Request, db: AsyncSession = Depends(get_db)):
    query = select(Product)
    result = await db.execute(query)
    guitars = result.scalars().all() 
    
    return templates.TemplateResponse("order.html", {
        "request": request, 
        "guitars": guitars 
    })

@app.get("/admin")
async def login_page(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})

@app.get("/courses", name="course")
async def get_courses(request: Request):
    return templates.TemplateResponse("courses.html", {"request": request})

@app.get("/repair", name="repair")
async def get_courses(request: Request):
    return templates.TemplateResponse("repair.html", {"request": request})


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)