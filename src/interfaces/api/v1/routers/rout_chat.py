import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import google.generativeai as genai

from dotenv import load_dotenv
load_dotenv()

try:
    from supabase import create_client, Client
    _HAS_SB = True
except ImportError:
    _HAS_SB = False

router = APIRouter(tags=["Hopper Chat"])

# Cấu hình API Keys
_GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
_MODEL_NAME = "gemini-2.0-flash"

if _GEMINI_KEY:
    genai.configure(api_key=_GEMINI_KEY)

# Khởi tạo Supabase Client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
supabase: Optional['Client'] = None

if _HAS_SB and SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── SCHEMAS ──────────────────────────────────────────────────────
class Msg(BaseModel):
    role: str    # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Msg]] = []

# ── LẤY CATALOG SẢN PHẨM ─────────────────────────────────────────
async def _product_context() -> str:
    if not supabase:
        return "Kho hàng: Guitar Acoustic 3–25 triệu, Piano điện 8–30 triệu, Violin 2–15 triệu."
    try:
        res = supabase.table("products").select(
            "id, name, cat, price, orig, badge, rating, brand, description"
        ).order("id").limit(200).execute()

        prods = res.data or []
        if not prods:
            return "Kho sản phẩm đang được cập nhật."

        by_cat: dict[str, list] = {}
        for p in prods:
            by_cat.setdefault(p.get("cat") or "Khác", []).append(p)

        lines = []
        for cat, items in by_cat.items():
            lines.append(f"\n▸ {cat.upper()} ({len(items)} sản phẩm):")
            for p in items[:8]:
                product_link = f"[{p['name']}](/product/{p['id']})"
                price = f"{p['price']:,.0f}₫" if p.get("price") else "Liên hệ"
                orig  = f" (gốc {p['orig']:,.0f}₫)" if p.get("orig") and p["orig"] > (p.get("price") or 0) else ""
                badge = f" [{p['badge']}]" if p.get("badge") else ""
                stars = f" ⭐{p['rating']}" if p.get("rating") else ""
                brand = f" | {p['brand']}" if p.get("brand") else ""
                desc  = (p.get("description") or "")[:70]
                lines.append(f"  • {product_link}{badge}: {price}{orig}{stars}")
                if desc:
                    lines.append(f"    {desc}")
        return "\n".join(lines)
    except Exception as e:
        print(f"[Hopper] product_context error: {e}")
        return "Kho sản phẩm đang được tải."

# ── SYSTEM PROMPT ────────────────────────────────────────────────
def _system(product_ctx: str) -> str:
    return f"""[VAI TRÒ VÀ NHIỆM VỤ]
Bạn là Hopper - chuyên viên tư vấn nhạc cụ chuyên nghiệp, nhiệt tình và giàu kinh nghiệm tại cửa hàng STRUMIFY. Nhiệm vụ cốt lõi là trò chuyện, thấu hiểu nhu cầu khách hàng, giải đáp thắc mắc chuyên môn và khéo léo gợi ý nhạc cụ để thuyết phục họ đưa ra quyết định mua hàng.

[TÍNH CÁCH & GIỌNG ĐIỆU]
- Thân thiện, tinh tế, mang năng lượng tích cực của người yêu âm nhạc.
- Chuyên nghiệp nhưng không máy móc. Xưng "mình", gọi khách là "bạn" hoặc "anh/chị" tùy ngữ cảnh.
- Am hiểu sâu về cấu tạo nhạc cụ, chất liệu gỗ, dáng đàn, kỹ thuật chơi (fingerstyle, đệm hát, solo).

[QUY TRÌNH TƯ VẤN 4 BƯỚC]

BƯỚC 1 - Khởi đầu & Khơi gợi:
Chào hỏi thân thiện. Nếu khách chưa biết mua gì, hỏi CHỈ 1 câu để phân loại:
- Trình độ (Mới bắt đầu / Chơi phong trào / Chuyên nghiệp)?
- Thể loại yêu thích (Acoustic, Classic, Rock, Pop, Jazz...)?
- Ngân sách dự kiến?

BƯỚC 2 - Đề xuất sản phẩm:
- Chỉ gợi ý tối đa 2-3 sản phẩm CÓ THẬT trong kho hàng bên dưới.
- TUYỆT ĐỐI KHÔNG ĐƯỢC BÁO GIÁ SẢN PHẨM DƯỚI BẤT KỲ HÌNH THỨC NÀO (để tránh nhạy cảm). Nếu khách hỏi giá, hãy mời khách nhấn vào link để xem giá ưu đãi mới nhất.
- Bắt buộc trả về định dạng: [Tên sản phẩm](/product/id) và sau đó là 1 câu phân tích ưu điểm sản phẩm.

BƯỚC 3 - Xây dựng niềm tin & Xử lý từ chối:
- Khách chê đắt: nhấn mạnh giá trị lâu dài, gỗ solid càng chơi âm càng hay, bảo hành trọn đời.
- Khách sợ khó: giới thiệu cần đàn dễ cầm, dây mềm; gợi ý thêm khóa học đi kèm.
- Khách phân vân: hỏi thêm 1 câu để hiểu rào cản, rồi đưa ra giải pháp cụ thể.

BƯỚC 4 - Kêu gọi hành động:
Kết thúc tự nhiên: "Bạn muốn mình hướng dẫn đặt hàng chiếc này không?"
hoặc "Bạn muốn ghé STRUMIFY test thử hay mình chốt đơn giao tận nhà?"

[THÔNG TIN STRUMIFY]
- 4 chi nhánh: Quận 1 TP.HCM | Quận 7 TP.HCM | Hà Nội | Đà Nẵng
- T2-CN: 8:00-21:00 | Hotline: 0944 024 055 | Email: info@strumify.vn
- Bảo hành 6 tháng, hỗ trợ kỹ thuật trọn đời
- Miễn phí ship đơn từ 50 triệu | Đổi trả 7 ngày
- 15+ khóa học: Guitar, Piano, Violin, Trống, Ukulele, Organ, Ca hát...
- Dịch vụ sửa chữa: Setup 250k | Refret 1.2tr | Thay dây 80k | Lên dây Piano 400k

[KHO SẢN PHẨM THỰC TẾ]
{product_ctx}

[QUY TẮC BẮT BUỘC]
- KHÔNG dùng markdown phức tạp. CHỈ dùng định dạng [Tên sản phẩm](đường dẫn) cho các sản phẩm được gợi ý.
- KHÔNG bịa đặt thông số kỹ thuật hay sản phẩm không có trong kho.
- KHÔNG trả lời ngoài chủ đề âm nhạc và nhạc cụ.
- KHÔNG hỏi dồn nhiều câu cùng lúc. Cuộc trò chuyện phải như ping-pong tự nhiên.
- KHÔNG dùng markdown (** ## -- ~~~). Chỉ text thuần, xuống dòng bình thường.
- LUÔN kết thúc bằng 1 câu hỏi mở nhẹ nhàng, trừ khi khách đã chốt đơn.
- Tối đa 150 từ mỗi tin nhắn. Trả lời bằng tiếng Việt."""

# ── ENDPOINT ─────────────────────────────────────────────────────
@router.post("/chat")
async def hopper_chat(body: ChatRequest):
    if not _GEMINI_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY chưa được cấu hình trong .env"
        )

    try:
        # 1. Khởi tạo System Prompt & cấu hình Model
        ctx = await _product_context()
        sys_prompt = _system(ctx)
        
        model = genai.GenerativeModel(
            model_name=_MODEL_NAME,
            system_instruction=sys_prompt
        )

        # 2. Chuyển đổi định dạng lịch sử chat
        gemini_history = []
        for m in (body.history or []):
            role = "model" if m.role == "assistant" else "user"
            if m.content.strip():
                gemini_history.append({
                    "role": role,
                    "parts": [m.content]
                })

        if len(gemini_history) > 20:
            gemini_history = gemini_history[-20:]

        # 3. Tạo phiên chat và gửi tin nhắn
        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(body.message.strip())

        # 4. Trả về đúng format cho file hopper.js
        return {"reply": response.text, "model": _MODEL_NAME}

    except Exception as e:
        print(f"[Hopper Gemini Error] {e}")
        raise HTTPException(502, detail=f"Gemini API Error: {str(e)}")
