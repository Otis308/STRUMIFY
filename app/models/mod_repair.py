# ================================================================
#  STRUMIFY – models/repair.py
#  SQLAlchemy 2.x (declarative) models cho module Sửa chữa
# ================================================================

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

# Import Base từ project của bạn
from database import Base


# ──────────────────────────────────────────────────────────────
#  Services – Danh mục dịch vụ
# ──────────────────────────────────────────────────────────────
class Service(Base):
    """
    Lưu tên dịch vụ, đơn giá, thời gian dự kiến.
    VD: "Setup Guitar", giá 250.000đ, 1-2 ngày.
    """
    __tablename__ = "services"

    id:              Mapped[int]          = mapped_column(Integer, primary_key=True, index=True)
    name:            Mapped[str]          = mapped_column(String(200), nullable=False)
    instrument_type: Mapped[str]          = mapped_column(String(80),  nullable=False, index=True)
    description:     Mapped[Optional[str]] = mapped_column(Text)
    base_price:      Mapped[float]        = mapped_column(Float, default=0)
    duration_days:   Mapped[Optional[str]] = mapped_column(String(40))   # VD: "1–2 ngày"
    tier:            Mapped[str]          = mapped_column(String(30), default="basic")  # basic | advanced
    is_active:       Mapped[bool]         = mapped_column(Boolean, default=True)
    created_at:      Mapped[datetime]     = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Quan hệ ngược
    order_services: Mapped[List["RepairOrderService"]] = relationship(back_populates="service")


# ──────────────────────────────────────────────────────────────
#  RepairOrders – Đơn sửa chữa
# ──────────────────────────────────────────────────────────────
class RepairOrder(Base):
    """
    Lưu toàn bộ thông tin một đơn sửa chữa từ khi tạo đến khi hoàn thành.
    """
    __tablename__ = "repair_orders"

    id:               Mapped[int]          = mapped_column(Integer, primary_key=True, index=True)
    code:             Mapped[str]          = mapped_column(String(30), unique=True, nullable=False, index=True)

    # Thông tin khách hàng
    customer_name:    Mapped[str]          = mapped_column(String(200), nullable=False)
    phone:            Mapped[str]          = mapped_column(String(20),  nullable=False)
    email:            Mapped[Optional[str]] = mapped_column(String(200))

    # Thông tin nhạc cụ
    instrument_type:  Mapped[str]          = mapped_column(String(80),  nullable=False)
    instrument_brand: Mapped[Optional[str]] = mapped_column(String(150))
    issue_description: Mapped[str]         = mapped_column(Text, nullable=False)

    # Lịch hẹn
    preferred_date:   Mapped[Optional[str]] = mapped_column(String(20))
    preferred_time:   Mapped[Optional[str]] = mapped_column(String(20), default="flexible")

    # Media (ảnh/video lỗi)
    media_urls:       Mapped[Optional[list]] = mapped_column(JSON, default=list)

    # Trạng thái workflow
    status:           Mapped[str]          = mapped_column(String(30), default="pending", index=True)

    # Tài chính
    estimated_cost:   Mapped[Optional[float]] = mapped_column(Float)   # Báo giá sơ bộ
    final_cost:       Mapped[Optional[float]] = mapped_column(Float)   # Chi phí thực tế
    is_approved:      Mapped[bool]            = mapped_column(Boolean, default=False)

    # Kỹ thuật viên phụ trách
    technician_name:  Mapped[Optional[str]] = mapped_column(String(200))
    technician_id:    Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    # Thời gian
    eta:              Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at:     Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at:       Mapped[datetime]           = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at:       Mapped[datetime]           = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Bảo hành
    warranty_expires: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Ghi chú nội bộ
    internal_note:    Mapped[Optional[str]] = mapped_column(Text)

    # Quan hệ
    logs:          Mapped[List["OrderLog"]]           = relationship(back_populates="repair_order", cascade="all, delete-orphan", order_by="OrderLog.created_at")
    order_services: Mapped[List["RepairOrderService"]] = relationship(back_populates="repair_order", cascade="all, delete-orphan")
    spare_parts:   Mapped[List["RepairOrderPart"]]    = relationship(back_populates="repair_order", cascade="all, delete-orphan")


# ──────────────────────────────────────────────────────────────
#  OrderLogs – Lịch sử trạng thái
# ──────────────────────────────────────────────────────────────
class OrderLog(Base):
    """
    Mỗi lần thay đổi trạng thái tạo ra một log entry.
    Ghi rõ ai thay đổi, khi nào, ghi chú gì.
    """
    __tablename__ = "order_logs"

    id:               Mapped[int]          = mapped_column(Integer, primary_key=True)
    repair_order_id:  Mapped[int]          = mapped_column(Integer, ForeignKey("repair_orders.id"), nullable=False, index=True)
    status:           Mapped[str]          = mapped_column(String(30), nullable=False)
    note:             Mapped[Optional[str]] = mapped_column(Text)
    updated_by:       Mapped[Optional[str]] = mapped_column(String(200))   # Tên kỹ thuật viên / hệ thống
    photo_urls:       Mapped[Optional[list]] = mapped_column(JSON, default=list)  # Ảnh tiến độ
    created_at:       Mapped[datetime]      = mapped_column(DateTime(timezone=True), server_default=func.now())

    repair_order: Mapped["RepairOrder"] = relationship(back_populates="logs")


# ──────────────────────────────────────────────────────────────
#  SpareParts – Kho linh kiện
# ──────────────────────────────────────────────────────────────
class SparePart(Base):
    """
    Quản lý linh kiện thay thế:
    dây đàn, tiềm biến, ngựa đàn, búa piano, pad flute...
    """
    __tablename__ = "spare_parts"

    id:              Mapped[int]          = mapped_column(Integer, primary_key=True)
    name:            Mapped[str]          = mapped_column(String(200), nullable=False)
    sku:             Mapped[Optional[str]] = mapped_column(String(80), unique=True, index=True)
    category:        Mapped[str]          = mapped_column(String(80))    # guitar | piano | violin | ...
    brand:           Mapped[Optional[str]] = mapped_column(String(100))
    unit_price:      Mapped[float]        = mapped_column(Float, default=0)
    stock_qty:       Mapped[int]          = mapped_column(Integer, default=0)
    min_stock:       Mapped[int]          = mapped_column(Integer, default=5)   # Cảnh báo khi dưới mức này
    description:     Mapped[Optional[str]] = mapped_column(Text)
    is_active:       Mapped[bool]         = mapped_column(Boolean, default=True)
    updated_at:      Mapped[datetime]     = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Quan hệ
    order_usages: Mapped[List["RepairOrderPart"]] = relationship(back_populates="spare_part")


# ──────────────────────────────────────────────────────────────
#  Junction tables
# ──────────────────────────────────────────────────────────────
class RepairOrderService(Base):
    """Dịch vụ được áp dụng cho một đơn sửa chữa (nhiều-nhiều)."""
    __tablename__ = "repair_order_services"

    id:             Mapped[int]   = mapped_column(Integer, primary_key=True)
    repair_order_id: Mapped[int]  = mapped_column(Integer, ForeignKey("repair_orders.id"), index=True)
    service_id:     Mapped[int]   = mapped_column(Integer, ForeignKey("services.id"))
    price_charged:  Mapped[float] = mapped_column(Float, default=0)   # Giá thực tính (có thể khác giá gốc)
    note:           Mapped[Optional[str]] = mapped_column(String(300))

    repair_order: Mapped["RepairOrder"] = relationship(back_populates="order_services")
    service:      Mapped["Service"]     = relationship(back_populates="order_services")


class RepairOrderPart(Base):
    """Linh kiện đã dùng trong một đơn sửa chữa."""
    __tablename__ = "repair_order_parts"

    id:             Mapped[int]   = mapped_column(Integer, primary_key=True)
    repair_order_id: Mapped[int]  = mapped_column(Integer, ForeignKey("repair_orders.id"), index=True)
    spare_part_id:  Mapped[int]   = mapped_column(Integer, ForeignKey("spare_parts.id"))
    quantity:       Mapped[int]   = mapped_column(Integer, default=1)
    unit_price:     Mapped[float] = mapped_column(Float)   # Giá tại thời điểm dùng

    repair_order: Mapped["RepairOrder"] = relationship(back_populates="spare_parts")
    spare_part:   Mapped["SparePart"]   = relationship(back_populates="order_usages")