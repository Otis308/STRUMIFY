"""
models/cart.py & models/enrollment.py – Strumify
Đặt trong thư mục app/models/
"""

# ================================================================
#  models/cart.py
# ================================================================
from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    BigInteger, Integer, ForeignKey, DateTime, UniqueConstraint,
    CheckConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.database import Base


class CartItem(Base):
    """
    Giỏ hàng server-side.
    Mỗi (user_id, product_id) là duy nhất.
    Khi thêm sản phẩm đã có → cộng dồn quantity (xử lý ở router).
    """
    __tablename__ = "cart_items"
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_cart_user_product"),
        CheckConstraint("quantity > 0", name="ck_cart_qty_positive"),
    )

    id:         Mapped[int]      = mapped_column(BigInteger, primary_key=True)
    user_id:    Mapped[int]      = mapped_column(BigInteger, ForeignKey("users.id",    ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[int]      = mapped_column(BigInteger, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity:   Mapped[int]      = mapped_column(Integer, default=1, nullable=False)
    added_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user:    Mapped["User"]    = relationship("User",    back_populates="cart_items",    lazy="selectin")
    product: Mapped["Product"] = relationship("Product", back_populates="cart_items",    lazy="selectin")


# ================================================================
#  models/enrollment.py
# ================================================================
class Enrollment(Base):
    """
    Lịch sử đăng ký khóa học.
    Sau khi đăng ký, hệ thống gửi email với:
      - Mã học viên (student_code) tự sinh
      - Tên học viên, Khóa học, Lớp học, Lịch học
    """
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_enrollment_user_course"),
    )

    id:             Mapped[int]           = mapped_column(BigInteger, primary_key=True)
    student_code:   Mapped[str]           = mapped_column(nullable=False, unique=True)   # STU-2026-00001
    user_id:        Mapped[int]           = mapped_column(BigInteger, ForeignKey("users.id"),    nullable=False, index=True)
    product_id:     Mapped[int]           = mapped_column(BigInteger, ForeignKey("products.id"), nullable=False, index=True)
    order_id:       Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("orders.id"),   nullable=True)
    class_name:     Mapped[Optional[str]] = mapped_column(nullable=True)
    schedule:       Mapped[Optional[str]] = mapped_column(nullable=True)
    instructor:     Mapped[Optional[str]] = mapped_column(nullable=True)
    status:         Mapped[str]           = mapped_column(default="active", nullable=False)
    email_sent:     Mapped[bool]          = mapped_column(default=False, nullable=False)
    email_sent_at:  Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    enrolled_at:    Mapped[datetime]      = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user:    Mapped["User"]    = relationship("User",    back_populates="enrollments", lazy="selectin")
    product: Mapped["Product"] = relationship("Product", back_populates="enrollments", lazy="selectin")