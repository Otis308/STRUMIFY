from typing import Optional
from datetime import datetime
from sqlalchemy import String, Integer, Float, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import relationship

# Đảm bảo đường dẫn import Base này đúng với project của bạn
from src.infrastructure.database.database import Base 

class Product(Base):
    __tablename__ = "products"

    # --- Các cột cơ bản ---
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    # --- Phân loại & Thương hiệu ---
    cat: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    brand: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    badge: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # --- Giá cả ---
    price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    orig: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # --- Hình ảnh ---
    img: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # --- Đánh giá ---
    rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reviews: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # --- Thông số kỹ thuật (Dạng Dictionary/JSON) ---
    specs: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    
    # --- Thời gian tạo (Tự động lấy giờ hệ thống khi tạo mới) ---
    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=True
    )