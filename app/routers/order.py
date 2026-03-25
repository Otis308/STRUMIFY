"""
app/routers/orders.py – Strumify
Mỗi đơn hàng gắn với user_id → hoàn toàn cách ly giữa các tài khoản.
Admin có thể xem tất cả đơn và cập nhật trạng thái.
"""
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.supabase_client import supabase
from app.core.security import get_current_user, require_admin

router = APIRouter(prefix="/orders", tags=["Orders"])

# ── SCHEMAS ──────────────────────────────────────────────────────
class OrderItem(BaseModel):
    product_id: int
    quantity:   int

class CreateOrderRequest(BaseModel):
    items:            list[OrderItem]
    receiver_name:    str
    receiver_phone:   str
    receiver_email:   Optional[str] = None
    receiver_address: str
    note:             Optional[str] = None
    pay_method:       str = "cod"     # cod | bank | momo
    coupon_code:      Optional[str] = None

VALID_STATUSES = {"processing", "confirmed", "shipping", "delivered", "cancelled"}

# ── HELPERS ───────────────────────────────────────────────────────
def gen_order_code() -> str:
    year = datetime.now(timezone.utc).year
    res  = supabase.table("orders").select("id").order("id", desc=True).limit(1).execute()
    last = res.data[0]["id"] if res.data else 0
    return f"STR-{year}-{last + 1:05d}"

def fetch_catalog(product_ids: list[int]) -> dict[int, dict]:
    """Lấy giá từ DB — không tin giá từ frontend."""
    res = supabase.table("products").select(
        "id, name, price, image_url, img, cat"
    ).in_("id", product_ids).execute()
    result = {}
    for p in (res.data or []):
        p["image_url"] = p.get("image_url") or p.get("img") or ""
        result[p["id"]] = p
    return result


# ── TẠO ĐƠN HÀNG ─────────────────────────────────────────────────
@router.post("/", status_code=201)
async def create_order(
    body: CreateOrderRequest,
    current_user: dict = Depends(get_current_user),
):
    if not body.items:
        raise HTTPException(400, detail="Giỏ hàng trống.")

    # 1. Lấy giá từ DB
    ids     = [it.product_id for it in body.items]
    catalog = fetch_catalog(ids)

    missing = [i for i in ids if i not in catalog]
    if missing:
        raise HTTPException(400, detail=f"Sản phẩm không tồn tại: {missing}")

    # 2. Tính subtotal
    subtotal = sum(
        catalog[it.product_id]["price"] * it.quantity
        for it in body.items
    )

    # 3. Validate coupon
    discount = 0
    coupon   = None
    if body.coupon_code:
        code   = body.coupon_code.upper().strip()
        cp_res = supabase.table("coupons") \
            .select("*").eq("code", code).eq("is_active", True).maybe_single().execute()
        cp = cp_res.data

        if not cp:
            raise HTTPException(400, detail=f'Mã "{code}" không hợp lệ.')
        if cp.get("expires_at") and cp["expires_at"] < datetime.now(timezone.utc).isoformat():
            raise HTTPException(400, detail="Mã giảm giá đã hết hạn.")
        if cp.get("max_uses") and cp.get("used_count", 0) >= cp["max_uses"]:
            raise HTTPException(400, detail="Mã giảm giá đã hết lượt sử dụng.")
        if subtotal < (cp.get("min_order") or 0):
            raise HTTPException(400, detail=f'Đơn tối thiểu {cp["min_order"]:,.0f}₫ để dùng mã này.')

        discount = int(subtotal * cp["value"] / 100) if cp["type"] == "percent" else int(cp["value"])
        coupon   = code

    # 4. Phí ship
    ship_fee = 0 if subtotal >= 50_000_000 else 20_000
    total    = max(0, subtotal - discount + ship_fee)

    # 5. Insert order — gắn user_id để cách ly tài khoản
    order_code = gen_order_code()
    order_data = {
        "order_code":       order_code,
        "user_id":          current_user["id"],   # ← KEY: cách ly theo user
        "receiver_name":    body.receiver_name,
        "receiver_phone":   body.receiver_phone,
        "receiver_email":   body.receiver_email or current_user.get("email"),
        "receiver_address": body.receiver_address,
        "note":             body.note or "",
        "pay_method":       body.pay_method,
        "subtotal":         subtotal,
        "discount":         discount,
        "ship_fee":         ship_fee,
        "total":            total,
        "coupon_code":      coupon,
        "status":           "processing",
    }
    order_res = supabase.table("orders").insert(order_data).execute()
    if not order_res.data:
        raise HTTPException(500, detail="Không thể tạo đơn hàng.")

    order_id = order_res.data[0]["id"]

    # 6. Insert order_items (snapshot tại thời điểm mua)
    items_data = [
        {
            "order_id":          order_id,
            "product_id":        it.product_id,
            "product_name":      catalog[it.product_id]["name"],
            "product_img":       catalog[it.product_id]["image_url"],
            "product_cat":       catalog[it.product_id].get("cat", ""),
            "price_at_purchase": catalog[it.product_id]["price"],
            "quantity":          it.quantity,
            "line_total":        catalog[it.product_id]["price"] * it.quantity,
        }
        for it in body.items
    ]
    supabase.table("order_items").insert(items_data).execute()

    # 7. Cập nhật used_count coupon
    if coupon:
        cur_res = supabase.table("coupons").select("used_count").eq("code", coupon).single().execute()
        new_count = (cur_res.data.get("used_count") or 0) + 1
        supabase.table("coupons").update({"used_count": new_count}).eq("code", coupon).execute()

    # 8. Cập nhật order_count và total_spent của user
    user_stats_res = supabase.table("users").select(
        "order_count, total_spent"
    ).eq("id", current_user["id"]).single().execute()
    if user_stats_res.data:
        new_count   = (user_stats_res.data.get("order_count") or 0) + 1
        new_spent   = (user_stats_res.data.get("total_spent")  or 0) + total
        supabase.table("users").update({
            "order_count": new_count,
            "total_spent": new_spent,
        }).eq("id", current_user["id"]).execute()

    return {
        "status":     "success",
        "order_code": order_code,
        "total":      total,
        "message":    "Đặt hàng thành công!",
    }


# ── ĐƠN HÀNG CỦA USER HIỆN TẠI ──────────────────────────────────
@router.get("/my")
async def get_my_orders(current_user: dict = Depends(get_current_user)):
    """Chỉ trả về đơn hàng của chính user đang đăng nhập."""
    res = supabase.table("orders").select(
        "id, order_code, status, total, subtotal, discount, ship_fee, "
        "pay_method, receiver_name, receiver_address, created_at, coupon_code"
    ).eq("user_id", current_user["id"]).order("created_at", desc=True).execute()

    orders = res.data or []
    for order in orders:
        items_res = supabase.table("order_items").select(
            "product_name, product_img, product_cat, price_at_purchase, quantity, line_total"
        ).eq("order_id", order["id"]).execute()
        order["items"] = items_res.data or []

    return {"orders": orders}


# ── CHI TIẾT 1 ĐƠN (user chỉ xem được của mình) ─────────────────
@router.get("/{order_code}")
async def get_order_detail(
    order_code: str,
    current_user: dict = Depends(get_current_user),
):
    res = supabase.table("orders").select("*").eq("order_code", order_code).maybe_single().execute()
    if not res.data:
        raise HTTPException(404, detail="Đơn hàng không tìm thấy.")

    order = res.data
    # Cách ly: user thường chỉ xem đơn của mình
    if order["user_id"] != current_user["id"] and current_user["role"] != "admin":
        raise HTTPException(403, detail="Bạn không có quyền xem đơn hàng này.")

    items_res = supabase.table("order_items").select("*").eq("order_id", order["id"]).execute()
    order["items"] = items_res.data or []
    return {"order": order}


# ── VALIDATE MÃ GIẢM GIÁ ─────────────────────────────────────────
@router.get("/coupons/{code}")
async def validate_coupon(
    code:     str,
    subtotal: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    code = code.upper().strip()
    res  = supabase.table("coupons").select("*") \
        .eq("code", code).eq("is_active", True).maybe_single().execute()

    if not res.data:
        raise HTTPException(400, detail=f'Mã "{code}" không hợp lệ.')

    cp = res.data
    if cp.get("expires_at") and cp["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(400, detail="Mã đã hết hạn.")
    if cp.get("max_uses") and cp.get("used_count", 0) >= cp["max_uses"]:
        raise HTTPException(400, detail="Mã đã hết lượt.")
    if subtotal > 0 and subtotal < (cp.get("min_order") or 0):
        raise HTTPException(400, detail=f'Đơn tối thiểu {cp["min_order"]:,.0f}₫.')

    discount = int(subtotal * cp["value"] / 100) if cp["type"] == "percent" else int(cp["value"])
    return {"valid": True, "code": code, "label": cp["label"], "discount": discount}


# ════════════════════════════════════════════════════════════════════
# ADMIN ROUTES – chỉ admin mới truy cập được
# ════════════════════════════════════════════════════════════════════

# ── TẤT CẢ ĐƠN HÀNG (admin dashboard) ───────────────────────────
@router.get("/admin/all")
async def admin_get_all_orders(
    status:   Optional[str] = None,
    page:     int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: dict = Depends(require_admin),
):
    """Admin xem toàn bộ đơn hàng của tất cả người dùng."""
    offset = (page - 1) * per_page
    query  = supabase.table("orders").select(
        "id, order_code, user_id, status, total, receiver_name, "
        "receiver_phone, pay_method, created_at, coupon_code"
    )
    if status:
        query = query.eq("status", status)

    res    = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    orders = res.data or []

    # Lấy thêm thông tin user và items
    for order in orders:
        user_res = supabase.table("users").select("username, email").eq("id", order["user_id"]).maybe_single().execute()
        order["user"] = user_res.data or {}

        items_res = supabase.table("order_items").select(
            "product_name, product_img, quantity, price_at_purchase, line_total"
        ).eq("order_id", order["id"]).execute()
        order["items"] = items_res.data or []

    # Tổng số đơn
    count_res = supabase.table("orders").select("id", count="exact").execute()
    total_count = count_res.count or 0

    return {
        "orders":      orders,
        "total":       total_count,
        "page":        page,
        "per_page":    per_page,
        "total_pages": -(-total_count // per_page),
    }


# ── CẬP NHẬT TRẠNG THÁI ĐƠN (admin) ─────────────────────────────
@router.put("/{order_code}/status")
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