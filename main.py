"""
main.py – Strumify API Entry Point
FIX: Removed all duplicate router registrations, duplicate static mounts,
     duplicate ChatRequest model, and cleaned import order.
"""
import os
from pathlib import Path

import requests
import uvicorn
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from google import genai
from pydantic import BaseModel
from src.shared.supabase_client import create_client

# ── Import routers (each only ONCE) ────────────────────────────
from src.interfaces.api.v1.routers.rout_auth    import router as auth_router
from src.interfaces.api.v1.routers.rout_cart    import router as cart_router
from src.interfaces.api.v1.routers.rout_chat    import router as chat_router
from src.interfaces.api.v1.routers.rout_order   import router as orders_router
from src.interfaces.api.v1.routers.rout_product import router as product_router
from src.interfaces.api.v1.routers.rout_profile import router as profile_router
from src.interfaces.api.v1.routers.rout_view    import router as view_router
from src.modules.order_management.presentation.routes  import router as order_router

# ── App Init ─────────────────────────────────────────────────────
app = FastAPI(title="Strumify API", version="2.0.0")

BASE_DIR = Path(__file__).resolve().parent

# ── CORS ─────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static Files (mounted ONCE, conditionally) ────────────────────
static_dir = BASE_DIR / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# ── Templates ─────────────────────────────────────────────────────
templates = Jinja2Templates(directory="src/interfaces/web/templates")

# ── Register Routers (each included ONCE, in logical order) ───────
app.include_router(auth_router,    tags=["Auth"])
app.include_router(product_router, prefix="/products", tags=["Products"])
app.include_router(orders_router,  tags=["Orders"])
app.include_router(cart_router) 
app.include_router(profile_router, tags=["Profile"])
app.include_router(chat_router,    tags=["Chat"])
app.include_router(view_router,    tags=["Pages"])
app.include_router(order_router)

# ── Misc ──────────────────────────────────────────────────────────
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

# ── Supabase & Gemini Config ──────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase     = create_client(SUPABASE_URL, SUPABASE_KEY)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ai_client = genai.Client(api_key=GEMINI_API_KEY)


# ── Schemas (defined ONCE) ────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str


# ── Helpers ───────────────────────────────────────────────────────
def get_products():
    try:
        res = supabase.table("products").select("*").execute()
        return res.data or []
    except Exception as e:
        print(f"Lỗi truy vấn Supabase: {e}")
        return []


# ── Chat endpoint (Gemini) ────────────────────────────────────────
@app.post("/chat")
async def chat(req: ChatRequest):
    all_products = get_products()

    catalog_text = ""
    for p in all_products:
        catalog_text += (
            f"- {p.get('name')}: {p.get('price')}đ. "
            f"Đặc điểm: {p.get('description', '')} | Tags: {p.get('tags', '')}\n"
        )

    prompt = f"""
Bạn là Hopper - chuyên gia tư vấn nhạc cụ của STRUMIFY.
Sản phẩm cửa hàng:
{catalog_text}

Khách hỏi: "{req.message}"
Nhiệm vụ: Phân tích nhu cầu, chọn 1-2 nhạc cụ phù hợp nhất, tư vấn thân thiện và chốt sale.
Yêu cầu: Trả lời ngắn gọn bằng tiếng Việt, xuống dòng dễ đọc, thêm emoji phù hợp.
"""

    try:
        response = ai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        if response.text:
            return {"reply": response.text}
        return {"reply": "Hopper đang suy nghĩ một chút, bạn hỏi lại câu khác nhé! 🎸"}
    except Exception as e:
        print(f"Lỗi Gemini: {e}")
        return {"reply": "Hopper hơi bận chỉnh dây đàn, bạn chờ mình vài giây nhé! 🎵"}