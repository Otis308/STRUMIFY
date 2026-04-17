import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv

# Load file .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# --- XỬ LÝ DATABASE URL ĐỂ DÙNG ASYNC DRIVER ---
if DATABASE_URL:
    # Nếu URL đang dùng postgres:// hoặc postgresql:// mặc định (thường là psycopg2)
    # thì chuyển sang dùng postgresql+asyncpg://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# --- SỬA ĐOẠN NÀY ---
engine = create_async_engine(
    DATABASE_URL,
    connect_args={
        "prepared_statement_cache_size": 0,
        "statement_cache_size": 0
    }
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)
# --------------------

# 1. ĐỊNH NGHĨA BASE
class Base(DeclarativeBase):
    pass

# 2. ĐỊNH NGHĨA GET_DB
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()