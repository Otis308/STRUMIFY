import uvicorn
from src.interfaces.api.v1.routers.rout_view import router as view_router
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from supabase import create_client
import os
import requests
from openai import OpenAI
from google import genai
from pathlib import Path




# ── Import Database & Models (/order) ───────────
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from src.infrastructure.database.database import get_db
from src.infrastructure.database.models.product import Product 
from src.modules.order_management.presentation.routes import router as order_router

# ── Import routers  ──────
from src.interfaces.api.v1.routers.rout_auth        import router as auth_router
from src.interfaces.api.v1.routers.rout_product     import router as product_router
from src.interfaces.api.v1.routers.rout_order       import router as orders_router
from src.interfaces.api.v1.routers.rout_view        import router as view_router
from src.interfaces.api.v1.routers.rout_chat        import router as chat_router
from src.interfaces.api.v1.routers.rout_cart        import router as cart_router
from src.interfaces.api.v1.routers.rout_order       import router as order_router
from src.interfaces.api.v1.routers.rout_profile     import router as profile_router
from src.interfaces.api.v1.routers.rout_cart        import router as cart_router
from src.interfaces.api.v1.routers.rout_order       import router as order_router

# ── App Init & Middleware ──
app = FastAPI(title="Strumify API")

BASE_DIR = Path(__file__).resolve().parent

# Chỉ mount static nếu thư mục tồn tại
static_dir = BASE_DIR / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    
#app.include_router(view_router, tags=["Pages"])
app.include_router(chat_router)
app.include_router(cart_router)  
app.include_router(order_router) 
app.include_router(profile_router)  
app.include_router(cart_router)     
app.include_router(order_router)     

def ask_gemini(user_message):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_API_KEY"

    body = {
        "contents": [{
            "parts": [{"text": f"Bạn là chuyên gia bán đàn guitar. Tư vấn ngắn gọn.\nUser: {user_message}"}]
        }]
    }

    res = requests.post(url, json=body)
    data = res.json()

    return data["candidates"][0]["content"]["parts"][0]["text"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files & Templates ───────────────────────────────────
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="src/interfaces/web/templates")
class ChatRequest(BaseModel):
    message: str
# ── Đăng ký routers ────────────────────────────────────────────
app.include_router(auth_router,    tags=["Auth"])
app.include_router(product_router, prefix="/products", tags=["Products"])
app.include_router(orders_router,                      tags=["Orders"])
app.include_router(view_router,                        tags=["Pages"])

# ── Misc routes ────────────────────────────────────────────────
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

# ===== CONFIG SUPABASE =====
client = genai.Client(api_key="GOOGLE_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ===== CONFIG GG GEMINI =====
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=GOOGLE_API_KEY)
class ChatRequest(BaseModel):
    message: str

def get_products():
    try:
        # Sử dụng client 'supabase' đã khởi tạo từ .env ở phần đầu file
        res = supabase.table("products").select("*").execute()
        return res.data or []
    except Exception as e:
        print(f"Lỗi truy vấn Supabase: {e}")
        return []
    
@app.post("/chat")
async def chat(req: ChatRequest):
    all_products = get_products()
    
    catalog_text = ""
    for p in all_products:
        catalog_text += f"- {p.get('name')}: {p.get('price')}đ. Đặc điểm: {p.get('tags')}\n"

    prompt = f"""
Bạn là Hopper - chuyên gia tư vấn nhạc cụ của STRUMIFY. 
Sản phẩm cửa hàng:
{catalog_text}

Khách hỏi: "{req.message}"
Nhiệm vụ: Phân tích nhu cầu, chọn 1-2 cây đàn phù hợp nhất, tư vấn thân thiện và chốt sale.
Yêu cầu: Trả lời ngắn gọn bằng tiếng Việt, xuống dòng dễ đọc.
"""

    try:
        # Sử dụng generate_content với cấu hình an toàn
        response = client.models.generate_content(
            model='gemini-2.0-flash', 
            contents='Hãy viết cho tôi mô tả của một cây đàn guitar acoustic.'
        )
        print(response.text)
        
        # Kiểm tra nếu response có nội dung (tránh lỗi block content)
        if response.text:
            return {"reply": response.text}
        else:
            return {"reply": "Hopper đang suy nghĩ một chút, bạn hỏi lại câu khác nhé!"}

    except Exception as e:
        print(f"Lỗi Gemini: {e}")
        # Nếu vẫn lỗi 404, thử fallback về model ổn định nhất
        return {"reply": "Hopper hơi bận chỉnh dây đàn, bạn chờ mình vài giây nhé!"}