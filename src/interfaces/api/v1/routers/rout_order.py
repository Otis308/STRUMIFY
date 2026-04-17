"""
routers/rout_order.py – Strumify (Updated)
Thanh toán → Lưu Orders → Dọn Cart → Tạo Enrollments → Gửi Email

Logic đặt hàng:
  1. Lấy giỏ hàng từ DB (không tin frontend)
  2. Verify giá từ bảng products
  3. Lưu orders + order_items
  4. Xóa cart_items của user
  5. Nếu có KHÓA HỌC → tạo enrollment → gửi email (background)
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, Query
from pydantic import BaseModel

from src.shared.supabase_client import supabase
from src.shared.security import get_current_user, require_admin
from src.infrastructure.services.email_service import send_enrollment_email

router = APIRouter(prefix="/orders", tags=["Orders"])

VALID_STATUSES = {"processing", "confirmed", "shipping", "delivered", "cancelled"}


# ── SCHEMAS ──────────────────────────────────────────────────────
class CheckoutRequest(BaseModel):
    """
    Frontend chỉ cần gửi thông tin giao hàng & coupon.
    Giỏ hàng lấy từ DB (cart_items của user).
    """
    receiver_name:    str
    receiver_phone:   str
    receiver_email:   Optional[str] = None
    receiver_address: str
    note:             Optional[str] = None
    pay_method:       str = "cod"       # cod | bank | momo
    coupon_code:      Optional[str] = None


# ── HELPERS ───────────────────────────────────────────────────────
def _gen_order_code() -> str:
    year = datetime.now(timezone.utc).year
    rand = secrets.token_hex(3).upper()
    res  = supabase.table("orders").select("id").order("id", desc=True).limit(1).execute()
    last = res.data[0]["id"] if res.data else 0
    return f"STR-{year}-{last + 1:05d}"


def _gen_student_code() -> str:
    year = datetime.now(timezone.utc).year
    res  = supabase.table("enrollments").select("id").order("id", desc=True).limit(1).execute()
    last = res.data[0]["id"] if res.data else 0
    return f"STU-{year}-{last + 1:05d}"


# ── CHECKOUT ─────────────────────────────────────────────────────
@router.post("/checkout", status_code=201, summary="Thanh toán giỏ hàng")
async def checkout(
    body:       CheckoutRequest,
    background: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """
    Data Flow:
      Cart DB → Verify giá → Tạo Order → Xóa Cart
      → Nếu có Course → Tạo Enrollment → Gửi Email (background)
    """
    user_id = current_user["id"]

    # ── 1. Lấy giỏ hàng từ DB ───────────────────────────────────
    cart_res = supabase.table("cart_items").select(
        "id, quantity, product_id, "
        "products(id, name, product_type, price, image_url, img, cat, "
        "         class_name, schedule, instructor)"
    ).eq("user_id", user_id).execute()

    cart_items = cart_res.data or []
    if not cart_items:
        raise HTTPException(400, detail="Giỏ hàng trống. Vui lòng thêm sản phẩm trước khi thanh toán.")

    # ── 2. Tính subtotal từ giá DB (không tin frontend) ──────────
    subtotal = sum(
        float(item["products"]["price"]) * item["quantity"]
        for item in cart_items
        if item.get("products")
    )

    # ── 3. Validate coupon ───────────────────────────────────────
    discount = 0
    coupon   = None
    if body.coupon_code:
        code   = body.coupon_code.upper().strip()
        cp_res = supabase.table("coupons").select("*").eq("code", code).eq("is_active", True).maybe_single().execute()
        cp = cp_res.data
        if not cp:
            raise HTTPException(400, detail=f'Mã "{code}" không hợp lệ.')
        if cp.get("expires_at") and cp["expires_at"] < datetime.now(timezone.utc).isoformat():
            raise HTTPException(400, detail="Mã giảm giá đã hết hạn.")
        if cp.get("max_uses") and int(cp.get("used_count", 0)) >= int(cp["max_uses"]):
            raise HTTPException(400, detail="Mã giảm giá đã hết lượt.")
        if subtotal < float(cp.get("min_order") or 0):
            raise HTTPException(400, detail=f'Đơn tối thiểu {float(cp["min_order"]):,.0f}₫ để dùng mã này.')

        discount = int(subtotal * cp["value"] / 100) if cp["type"] == "percent" else int(cp["value"])
        coupon   = code

    ship_fee = 0 if subtotal >= 50_000_000 else 20_000
    total    = max(0, int(subtotal) - discount + ship_fee)

    # ── 4. Tạo đơn hàng ──────────────────────────────────────────
    order_code = _gen_order_code()
    order_data = {
        "order_code":       order_code,
        "user_id":          user_id,
        "receiver_name":    body.receiver_name,
        "receiver_phone":   body.receiver_phone,
        "receiver_email":   body.receiver_email or current_user.get("email", ""),
        "receiver_address": body.receiver_address,
        "note":             body.note or "",
        "pay_method":       body.pay_method,
        "subtotal":         int(subtotal),
        "discount":         discount,
        "ship_fee":         ship_fee,
        "total":            total,
        "coupon_code":      coupon,
        "status":           "processing",
    }
    order_res = supabase.table("orders").insert(order_data).execute()
    if not order_res.data:
        raise HTTPException(500, detail="Không thể tạo đơn hàng. Vui lòng thử lại.")

    order_id = order_res.data[0]["id"]

    # ── 5. Lưu order_items (snapshot giá tại thời điểm mua) ──────
    order_items_data = []
    for item in cart_items:
        p = item.get("products") or {}
        order_items_data.append({
            "order_id":          order_id,
            "product_id":        item["product_id"],
            "product_name":      p.get("name", ""),
            "product_img":       p.get("image_url") or p.get("img") or "",
            "product_cat":       p.get("cat", ""),
            "item_type":         p.get("product_type", "product"),
            "price_at_purchase": float(p.get("price") or 0),
            "quantity":          item["quantity"],
            "line_total":        float(p.get("price") or 0) * item["quantity"],
        })
    supabase.table("order_items").insert(order_items_data).execute()

    # ── 6. Xóa giỏ hàng (Data Flow Step 4) ───────────────────────
    supabase.table("cart_items").delete().eq("user_id", user_id).execute()

    # ── 7. Cập nhật coupon used_count ────────────────────────────
    if coupon:
        cur = supabase.table("coupons").select("used_count").eq("code", coupon).single().execute()
        new_count = int(cur.data.get("used_count") or 0) + 1
        supabase.table("coupons").update({"used_count": new_count}).eq("code", coupon).execute()

    # ── 8. Cập nhật thống kê user ─────────────────────────────────
    u_stats = supabase.table("users").select("order_count, total_spent").eq("id", user_id).single().execute()
    if u_stats.data:
        supabase.table("users").update({
            "order_count": int(u_stats.data.get("order_count") or 0) + 1,
            "total_spent":  int(u_stats.data.get("total_spent")  or 0) + total,
        }).eq("id", user_id).execute()

    # ── 9. XỬ LÝ KHÓA HỌC: Tạo enrollment + gửi email ───────────
    course_items   = [i for i in cart_items if (i.get("products") or {}).get("product_type") == "course"]
    enrollments_created = []

    for item in course_items:
        p            = item["products"]
        student_code = _gen_student_code()
        class_name   = p.get("class_name") or f"Lớp {p.get('name', '')}"
        schedule     = p.get("schedule")
        instructor   = p.get("instructor")

        # Lưu enrollment
        enroll_res = supabase.table("enrollments").insert({
            "student_code": student_code,
            "user_id":      user_id,
            "product_id":   item["product_id"],
            "order_id":     order_id,
            "class_name":   class_name,
            "schedule":     schedule,
            "instructor":   instructor,
            "status":       "active",
            "email_sent":   False,
        }).execute()

        if enroll_res.data:
            enrollment_id = enroll_res.data[0]["id"]
            enrollments_created.append({
                "enrollment_id": enrollment_id,
                "student_code":  student_code,
                "course_name":   p.get("name", ""),
                "class_name":    class_name,
            })

            # Gửi email trong background (không block response)
            to_email     = body.receiver_email or current_user.get("email", "")
            student_name = body.receiver_name  or current_user.get("username", "")

            background.add_task(
                _send_enrollment_email_and_update,
                enrollment_id = enrollment_id,
                to_email      = to_email,
                student_name  = student_name,
                student_code  = student_code,
                course_name   = p.get("name", ""),
                class_name    = class_name,
                schedule      = schedule,
                instructor    = instructor,
            )

    return {
        "status":       "success",
        "order_code":   order_code,
        "total":        total,
        "item_count":   sum(i["quantity"] for i in cart_items),
        "message":      "Đặt hàng thành công!",
        "enrollments":  enrollments_created,
    }


async def _send_enrollment_email_and_update(
    enrollment_id: int,
    to_email: str,
    student_name: str,
    student_code: str,
    course_name: str,
    class_name: str,
    schedule: Optional[str],
    instructor: Optional[str],
):
    """Background task: Gửi email → Cập nhật email_sent trong DB."""
    sent = await send_enrollment_email(
        to_email     = to_email,
        student_name = student_name,
        student_code = student_code,
        course_name  = course_name,
        class_name   = class_name,
        schedule     = schedule,
        instructor   = instructor,
    )
    if sent:
        supabase.table("enrollments").update({
            "email_sent":    True,
            "email_sent_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", enrollment_id).execute()


# ── LẤY LỊCH SỬ ĐƠN HÀNG (user) ─────────────────────────────────
@router.get("/my", summary="Lịch sử mua hàng của user hiện tại")
async def get_my_orders(current_user: dict = Depends(get_current_user)):
    res = supabase.table("orders").select(
        "id, order_code, status, total, subtotal, discount, ship_fee, "
        "pay_method, receiver_name, receiver_address, created_at, coupon_code"
    ).eq("user_id", current_user["id"]).order("created_at", desc=True).execute()

    orders = res.data or []
    for order in orders:
        items_res = supabase.table("order_items").select(
            "product_name, product_img, product_cat, item_type, "
            "price_at_purchase, quantity, line_total"
        ).eq("order_id", order["id"]).execute()
        order["items"] = items_res.data or []

    return {"orders": orders}


# ── LẤY LỊCH SỬ ĐĂNG KÝ KHÓA HỌC ───────────────────────────────
@router.get("/my/enrollments", summary="Các khóa học đã đăng ký")
async def get_my_enrollments(current_user: dict = Depends(get_current_user)):
    res = supabase.table("enrollments").select(
        "id, student_code, status, class_name, schedule, instructor, enrolled_at, "
        "products(id, name, image_url, img, cat, instructor, duration)"
    ).eq("user_id", current_user["id"]).order("enrolled_at", desc=True).execute()

    return {"enrollments": res.data or []}


# ── CHI TIẾT 1 ĐƠN HÀNG ─────────────────────────────────────────
@router.get("/{order_code}", summary="Chi tiết đơn hàng")
async def get_order_detail(
    order_code: str,
    current_user: dict = Depends(get_current_user),
):
    res = supabase.table("orders").select("*").eq("order_code", order_code).maybe_single().execute()
    if not res.data:
        raise HTTPException(404, detail="Đơn hàng không tìm thấy.")

    order = res.data
    if order["user_id"] != current_user["id"] and current_user.get("role") != "admin":
        raise HTTPException(403, detail="Bạn không có quyền xem đơn hàng này.")

    items_res = supabase.table("order_items").select("*").eq("order_id", order["id"]).execute()
    order["items"] = items_res.data or []
    return {"order": order}


# ── ADMIN: CẬP NHẬT TRẠNG THÁI ───────────────────────────────────
@router.put("/{order_code}/status", summary="[Admin] Cập nhật trạng thái đơn")
async def update_order_status(
    order_code: str,
    new_status: str,
    admin: dict = Depends(require_admin),
):
    if new_status not in VALID_STATUSES:
        raise HTTPException(400, detail=f"Trạng thái không hợp lệ. Chọn: {VALID_STATUSES}")

    res = supabase.table("orders").update({"status": new_status}).eq("order_code", order_code).execute()
    if not res.data:
        raise HTTPException(404, detail="Đơn hàng không tìm thấy.")

    return {"status": "success", "order_code": order_code, "new_status": new_status}


# ── ADMIN: TẤT CẢ ĐƠN HÀNG ──────────────────────────────────────
@router.get("/admin/all", summary="[Admin] Danh sách tất cả đơn hàng")
async def admin_get_all_orders(
    status:   Optional[str] = None,
    page:     int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: dict = Depends(require_admin),
):
    offset = (page - 1) * per_page
    query  = supabase.table("orders").select(
        "id, order_code, user_id, status, total, receiver_name, "
        "receiver_phone, pay_method, created_at"
    )
    if status: query = query.eq("status", status)
    res    = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    orders = res.data or []

    for order in orders:
        u_res = supabase.table("users").select("username, email").eq("id", order["user_id"]).maybe_single().execute()
        order["user"] = u_res.data or {}
        i_res = supabase.table("order_items").select("product_name, quantity, price_at_purchase, item_type").eq("order_id", order["id"]).execute()
        order["items"] = i_res.data or []

    count_res   = supabase.table("orders").select("id", count="exact").execute()
    total_count = count_res.count or 0

    return {
        "orders":      orders,
        "total":       total_count,
        "page":        page,
        "per_page":    per_page,
        "total_pages": -(-total_count // per_page),
    }