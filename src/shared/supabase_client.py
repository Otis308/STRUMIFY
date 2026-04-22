
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")


if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY trong file .env\n"
        "   Xem .env.example để biết cách cài đặt."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("[DEV] Đã kết nối Supabase Sync Client thành công!")


"""
app/core/supabase_client.py
Kết nối Supabase. KHÔNG hardcode key ở đây.
Tất cả key phải nằm trong file .env
"""
