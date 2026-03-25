"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://wpbmixpiydtbrgcentrt.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwYm1peHBpeWR0YnJnY2VudHJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY3Mzk4NSwiZXhwIjoyMDg5MjQ5OTg1fQ.cp7sr9cLdJx4WwWaOj0G3TV99BFQ5XM934ZLU4vO43A")


if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY trong file .env\n"
        "   Xem .env.example để biết cách cài đặt."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("[DEV] Đã kết nối Supabase Sync Client thành công!")
"""

"""
app/core/supabase_client.py
Kết nối Supabase. KHÔNG hardcode key ở đây.
Tất cả key phải nằm trong file .env
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")  # service_role key

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY trong file .env\n"
        "   Xem .env.example để biết cách cài đặt."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)