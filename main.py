"""
main.py – Strumify API Entry Point
FIX: Removed all duplicate router registrations, duplicate static mounts,
     duplicate ChatRequest model, and cleaned import order.
"""
import os
import json
import time
from pathlib import Path

import requests
import uvicorn
from fastapi import FastAPI, Response
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse
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

_DEBUG_LOG_PATH = "debug-368463.log"
_DEBUG_SESSION_ID = "368463"


def _dbg_log(*, run_id: str, hypothesis_id: str, location: str, message: str, data: dict) -> None:
    try:
        payload = {
            "sessionId": _DEBUG_SESSION_ID,
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        with open(str(BASE_DIR / _DEBUG_LOG_PATH), "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        pass

# ── CORS ─────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def _debug_request_logger(request: Request, call_next):
    # #region agent log
    start = time.time()
    path = request.url.path
    method = request.method
    # #endregion
    # #region agent log
    if path.startswith("/cart/add") or path.startswith("/cart/"):
        _dbg_log(
            run_id="pre-fix",
            hypothesis_id="M0",
            location="main.py:middleware",
            message="Incoming request for cart endpoints",
            data={"method": method, "path": path, "query": dict(request.query_params)},
        )
    # #endregion
    try:
        response = await call_next(request)
        # #region agent log
        if path.startswith("/cart/add") or path.startswith("/cart/"):
            _dbg_log(
                run_id="pre-fix",
                hypothesis_id="M1",
                location="main.py:middleware",
                message="Request/response trace for cart endpoints",
                data={
                    "method": method,
                    "path": path,
                    "status": getattr(response, "status_code", None),
                    "ms": int((time.time() - start) * 1000),
                    "content_type": response.headers.get("content-type") if hasattr(response, "headers") else None,
                },
            )
        # #endregion
        return response
    except Exception as e:
        # #region agent log
        if path.startswith("/cart/add") or path.startswith("/cart/"):
            _dbg_log(
                run_id="pre-fix",
                hypothesis_id="M2",
                location="main.py:middleware",
                message="Unhandled exception bubbled through middleware",
                data={
                    "method": method,
                    "path": path,
                    "ms": int((time.time() - start) * 1000),
                    "error_type": type(e).__name__,
                    "error": str(e),
                },
            )
        # #endregion
        raise


@app.on_event("startup")
async def _debug_startup_ping():
    # #region agent log
    _dbg_log(
        run_id="pre-fix",
        hypothesis_id="BOOT",
        location="main.py:startup",
        message="Debug logger startup ping",
        data={"base_dir": str(BASE_DIR)},
    )
    # #endregion


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # #region agent log
    body_keys = None
    body_len = None
    body_parse_err = None
    try:
        raw = await request.body()
        body_len = len(raw or b"")
        try:
            parsed = json.loads(raw.decode("utf-8")) if raw else None
            if isinstance(parsed, dict):
                body_keys = sorted(list(parsed.keys()))
            elif parsed is not None:
                body_keys = ["_non_dict_json"]
        except Exception as e:
            body_parse_err = str(e)
    except Exception as e:
        body_parse_err = str(e)

    _dbg_log(
        run_id="pre-fix",
        hypothesis_id="H0",
        location="main.py:RequestValidationError",
        message="Request validation failed before reaching handler",
        data={
            "method": request.method,
            "path": request.url.path,
            "query": dict(request.query_params),
            "content_type": request.headers.get("content-type"),
            "body_len": body_len,
            "body_keys": body_keys,
            "body_parse_err": body_parse_err,
            "errors": exc.errors(),
        },
    )
    # #endregion
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

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