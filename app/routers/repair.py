# ================================================================
#  STRUMIFY – routers/repair.py
#  Module: Bảo dưỡng & Sửa chữa
#  Endpoints:
#    POST /repairs/bookings/          → Tạo đơn sửa chữa mới
#    GET  /repairs/track/{code}       → Tra cứu trạng thái đơn
#    GET  /repairs/orders/            → Admin: danh sách đơn
#    PATCH /repairs/orders/{id}/status → Admin: cập nhật trạng thái
#    GET  /repairs/services/          → Danh mục dịch vụ
# ================================================================

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta
from typing import Annotated, List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Path,
    Query,
    UploadFile,
    status,
)
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# ── Import từ project của bạn ──────────────────────────────────
from database import get_async_db          # async session factory
from models.repair import (               # SQLAlchemy models (xem models/repair.py)
    RepairOrder,
    OrderLog,
    Service,
    SparePart,
)
from utils.auth import get_current_user, require_admin   # auth helpers của bạn
from utils.storage import upload_file_to_supabase        # storage helper
from tasks.notifications import (         # Celery tasks (xem tasks/notifications.py)
    send_booking_confirmation,
    send_status_update_notification,
)

router = APIRouter(prefix="/repairs", tags=["Repair & Maintenance"])

# ──────────────────────────────────────────────────────────────
#  ENUMS & CONSTANTS
# ──────────────────────────────────────────────────────────────

REPAIR_STATUSES = [
    "pending",           # Tiếp nhận
    "diagnosing",        # Giám định
    "waiting_approval",  # Chờ khách duyệt giá
    "repairing",         # Đang sửa chữa
    "testing",           # Kiểm âm & hoàn thiện
    "completed",         # Hoàn thành
    "cancelled",         # Hủy
]

STATUS_LABEL = {
    "pending":           "Tiếp nhận",
    "diagnosing":        "Đang giám định",
    "waiting_approval":  "Chờ khách duyệt giá",
    "repairing":         "Đang sửa chữa",
    "testing":           "Kiểm âm & hoàn thiện",
    "completed":         "Đã hoàn thành",
    "cancelled":         "Đã hủy",
}

MEDIA_DIR = "static/uploads/repairs"
os.makedirs(MEDIA_DIR, exist_ok=True)

# ──────────────────────────────────────────────────────────────
#  PYDANTIC SCHEMAS (inline; hoặc chuyển sang schemas/repair.py)
# ──────────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    customer_name:    str
    phone:            str
    email:            Optional[str] = None
    instrument_type:  str
    instrument_brand: Optional[str] = None
    issue_description: str
    preferred_date:   Optional[str] = None
    preferred_time:   Optional[str] = "flexible"

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        digits = v.replace(" ", "").replace("-", "")
        if not digits.startswith(("0", "+84")) or len(digits) < 9:
            raise ValueError("Số điện thoại không hợp lệ")
        return v


class OrderLogOut(BaseModel):
    status:     str
    note:       Optional[str]
    created_at: datetime
    technician: Optional[str] = None

    class Config:
        from_attributes = True


class TrackResponse(BaseModel):
    code:        str
    instrument:  str
    technician:  Optional[str]
    eta:         Optional[str]
    status:      str
    logs:        List[OrderLogOut]


class StatusUpdatePayload(BaseModel):
    status:      str
    note:        Optional[str] = None
    estimated_cost: Optional[float] = None  # Dùng khi chuyển sang waiting_approval
    eta_days:    Optional[int] = None        # Số ngày dự kiến hoàn thành từ hôm nay


class OrderListItem(BaseModel):
    id:             int
    code:           str
    customer_name:  str
    phone:          str
    instrument_type: str
    status:         str
    total_cost:     Optional[float]
    technician:     Optional[str]
    created_at:     datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────────────────────
#  HELPER
# ──────────────────────────────────────────────────────────────

def _generate_order_code() -> str:
    """Tạo mã đơn dạng SVC-YYMMDD-XXXX"""
    today  = datetime.now().strftime("%y%m%d")
    suffix = uuid.uuid4().hex[:4].upper()
    return f"SVC-{today}-{suffix}"


async def _save_media_files(
    files: List[UploadFile],
    order_code: str,
) -> List[str]:
    """Lưu file media và trả về danh sách URL."""
    urls = []
    for f in files[:5]:  # tối đa 5 file
        if not f.filename:
            continue
        ext  = os.path.splitext(f.filename)[1].lower()
        name = f"{order_code}_{uuid.uuid4().hex[:8]}{ext}"
        path = os.path.join(MEDIA_DIR, name)

        content = await f.read()
        if len(content) > 20 * 1024 * 1024:
            continue  # bỏ qua file > 20MB

        # Thử upload lên Supabase Storage, fallback local
        try:
            url = await upload_file_to_supabase(content, name, f.content_type)
        except Exception:
            with open(path, "wb") as fp:
                fp.write(content)
            url = f"/{path}"

        urls.append(url)
    return urls


# ──────────────────────────────────────────────────────────────
#  PUBLIC ENDPOINTS
# ──────────────────────────────────────────────────────────────

@router.post("/bookings/", status_code=status.HTTP_201_CREATED)
async def create_booking(
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    # Form fields
    customer_name:    str = Form(...),
    phone:            str = Form(...),
    email:            Optional[str] = Form(None),
    instrument_type:  str = Form(...),
    instrument_brand: Optional[str] = Form(None),
    issue_description: str = Form(...),
    preferred_date:   Optional[str] = Form(None),
    preferred_time:   Optional[str] = Form("flexible"),
    # File upload (optional)
    media: Optional[List[UploadFile]] = File(None),
):
    """
    Tạo đơn bảo dưỡng / sửa chữa mới.
    Hỗ trợ upload ảnh/video kèm theo.
    """
    # Validate bằng Pydantic
    payload = BookingCreate(
        customer_name=customer_name,
        phone=phone,
        email=email,
        instrument_type=instrument_type,
        instrument_brand=instrument_brand,
        issue_description=issue_description,
        preferred_date=preferred_date,
        preferred_time=preferred_time,
    )

    code = _generate_order_code()

    # Lưu media files
    media_urls: List[str] = []
    if media:
        media_urls = await _save_media_files(media, code)

    # Tạo đơn hàng
    order = RepairOrder(
        code=code,
        customer_name=payload.customer_name,
        phone=payload.phone,
        email=payload.email,
        instrument_type=payload.instrument_type,
        instrument_brand=payload.instrument_brand,
        issue_description=payload.issue_description,
        preferred_date=payload.preferred_date,
        preferred_time=payload.preferred_time,
        media_urls=media_urls,
        status="pending",
    )
    db.add(order)

    # Tạo log đầu tiên
    log = OrderLog(
        repair_order=order,
        status="pending",
        note="Đơn hàng được tạo thành công. Chúng tôi sẽ liên hệ trong 2 giờ.",
    )
    db.add(log)
    await db.commit()
    await db.refresh(order)

    # Gửi email xác nhận bất đồng bộ (Celery)
    background_tasks.add_task(
        send_booking_confirmation,
        email=payload.email,
        name=payload.customer_name,
        order_code=code,
        instrument=payload.instrument_type,
    )

    return {
        "message":    "Đặt lịch thành công",
        "order_code": code,
        "id":         order.id,
    }


@router.get("/track/{code}", response_model=TrackResponse)
async def track_order(
    code: str = Path(..., description="Mã đơn sửa chữa, VD: SVC-240001"),
    db: Annotated[AsyncSession, Depends(get_async_db)] = None,
):
    """Tra cứu trạng thái đơn hàng theo mã — không yêu cầu đăng nhập."""
    result = await db.execute(
        select(RepairOrder).where(RepairOrder.code == code.upper())
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    logs_result = await db.execute(
        select(OrderLog)
        .where(OrderLog.repair_order_id == order.id)
        .order_by(OrderLog.created_at.asc())
    )
    logs = logs_result.scalars().all()

    eta_str = None
    if order.eta:
        eta_str = order.eta.strftime("%d/%m/%Y")

    return TrackResponse(
        code=order.code,
        instrument=f"{order.instrument_type} – {order.instrument_brand or ''}".strip(" –"),
        technician=order.technician_name,
        eta=eta_str,
        status=order.status,
        logs=[
            OrderLogOut(
                status=l.status,
                note=l.note,
                created_at=l.created_at,
                technician=l.updated_by,
            )
            for l in logs
        ],
    )


@router.get("/services/")
async def list_services(
    instrument: Optional[str] = Query(None),
    db: Annotated[AsyncSession, Depends(get_async_db)] = None,
):
    """Danh mục dịch vụ công khai."""
    q = select(Service).where(Service.is_active == True)
    if instrument:
        q = q.where(Service.instrument_type == instrument)
    result = await db.execute(q)
    return result.scalars().all()


# ──────────────────────────────────────────────────────────────
#  ADMIN ENDPOINTS (yêu cầu quyền admin)
# ──────────────────────────────────────────────────────────────

@router.get("/orders/", response_model=List[OrderListItem])
async def list_orders(
    status_filter: Optional[str] = Query(None),
    instrument:    Optional[str] = Query(None),
    page:          int           = Query(1, ge=1),
    per_page:      int           = Query(20, le=100),
    db: Annotated[AsyncSession, Depends(get_async_db)] = None,
    _admin = Depends(require_admin),
):
    """Admin: Lấy danh sách tất cả đơn sửa chữa có phân trang & filter."""
    q = select(RepairOrder)
    if status_filter:
        q = q.where(RepairOrder.status == status_filter)
    if instrument:
        q = q.where(RepairOrder.instrument_type == instrument)
    q = (
        q.order_by(RepairOrder.created_at.desc())
         .offset((page - 1) * per_page)
         .limit(per_page)
    )
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/orders/{order_id}/status", status_code=status.HTTP_200_OK)
async def update_order_status(
    background_tasks: BackgroundTasks,
    order_id: int,
    payload:  StatusUpdatePayload,
    db: Annotated[AsyncSession, Depends(get_async_db)] = None,
    current_user = Depends(get_current_user),
    _admin       = Depends(require_admin),
):
    """
    Admin/Technician: Cập nhật trạng thái đơn sửa chữa.
    Tự động gửi thông báo Email/SMS qua Celery.

    Workflow engine đảm bảo chỉ chuyển trạng thái hợp lệ:
      pending → diagnosing → waiting_approval → repairing → testing → completed
    """
    result = await db.execute(select(RepairOrder).where(RepairOrder.id == order_id))
    order  = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    # ── Validate workflow transition ──
    allowed = _get_allowed_next_statuses(order.status)
    if payload.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Không thể chuyển từ '{order.status}' sang '{payload.status}'. "
                   f"Chỉ cho phép: {allowed}",
        )

    old_status   = order.status
    order.status = payload.status

    if payload.estimated_cost is not None:
        order.estimated_cost = payload.estimated_cost
    if payload.eta_days is not None:
        order.eta = datetime.utcnow() + timedelta(days=payload.eta_days)

    # Gán kỹ thuật viên nếu chưa có
    if not order.technician_name and hasattr(current_user, "full_name"):
        order.technician_name = current_user.full_name

    # Tạo log
    log = OrderLog(
        repair_order_id=order.id,
        status=payload.status,
        note=payload.note,
        updated_by=getattr(current_user, "full_name", "Admin"),
    )
    db.add(log)
    await db.commit()
    await db.refresh(order)

    # ── Gửi thông báo bất đồng bộ ──
    background_tasks.add_task(
        send_status_update_notification,
        email=order.email,
        phone=order.phone,
        name=order.customer_name,
        order_code=order.code,
        old_status=STATUS_LABEL.get(old_status, old_status),
        new_status=STATUS_LABEL.get(payload.status, payload.status),
        note=payload.note,
        estimated_cost=payload.estimated_cost,
    )

    return {
        "message":    f"Cập nhật trạng thái thành công: {payload.status}",
        "order_code": order.code,
        "status":     order.status,
    }


@router.patch("/orders/{order_id}/assign")
async def assign_technician(
    order_id:       int,
    technician_name: str,
    db: Annotated[AsyncSession, Depends(get_async_db)] = None,
    _admin = Depends(require_admin),
):
    """Admin: Phân công kỹ thuật viên cho đơn hàng."""
    result = await db.execute(select(RepairOrder).where(RepairOrder.id == order_id))
    order  = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    order.technician_name = technician_name
    await db.commit()
    return {"message": f"Đã phân công cho {technician_name}"}


# ──────────────────────────────────────────────────────────────
#  WORKFLOW ENGINE
# ──────────────────────────────────────────────────────────────

_TRANSITIONS: dict[str, list[str]] = {
    "pending":           ["diagnosing", "cancelled"],
    "diagnosing":        ["waiting_approval", "cancelled"],
    "waiting_approval":  ["repairing", "cancelled"],
    "repairing":         ["testing", "cancelled"],
    "testing":           ["completed", "repairing"],  # repairing = phát hiện lỗi mới
    "completed":         [],
    "cancelled":         [],
}

def _get_allowed_next_statuses(current: str) -> list[str]:
    return _TRANSITIONS.get(current, [])