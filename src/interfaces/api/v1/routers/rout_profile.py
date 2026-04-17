"""
routers/rout_profile.py – Strumify
Endpoints cho profile user: orders, enrollments, v.v.

API Routes:
  GET  /profile/orders      → Lịch sử mua hàng của user hiện tại
  GET  /profile/enrollments → Khóa học đã đăng ký
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from src.shared.supabase_client import supabase
from src.shared.security import get_current_user

router = APIRouter(prefix="/profile", tags=["Profile"])


# ── GET /profile/orders ─────────────────────────────────────────
@router.get("/orders", summary="Lịch sử mua hàng")
async def get_user_orders(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
):
    """
    Lấy tất cả đơn hàng của user hiện tại từ database.
    Phân trang tùy chọn.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(401, detail="User not authenticated")

    # Tính offset
    offset = (page - 1) * per_page

    # Query orders
    try:
        orders_res = supabase.table("orders").select(
            "id, order_code, status, total, subtotal, discount, ship_fee, "
            "receiver_name, receiver_phone, receiver_address, receiver_email, "
            "pay_method, coupon_code, note, created_at, updated_at"
        ).eq("user_id", user_id).order("created_at", desc=True).range(
            offset, offset + per_page - 1
        ).execute()

        orders = orders_res.data or []

        # Fetch items cho mỗi order
        for order in orders:
            items_res = supabase.table("order_items").select(
                "id, product_id, product_name, product_img, product_cat, item_type, "
                "price_at_purchase, quantity, line_total"
            ).eq("order_id", order["id"]).execute()
            order["items"] = items_res.data or []

        # Get total count
        count_res = supabase.table("orders").select("id", count="exact").eq(
            "user_id", user_id
        ).execute()
        total_count = count_res.count or 0

        return {
            "status": "success",
            "orders": orders,
            "total_count": total_count,
            "page": page,
            "per_page": per_page,
            "total_pages": -(-total_count // per_page) if total_count > 0 else 0,
        }

    except Exception as e:
        raise HTTPException(500, detail=f"Database error: {str(e)}")


# ── GET /profile/enrollments ────────────────────────────────────
@router.get("/enrollments", summary="Khóa học đã đăng ký")
async def get_user_enrollments(
    current_user: dict = Depends(get_current_user),
):
    """
    Lấy tất cả khóa học đã đăng ký của user hiện tại.
    Bao gồm thông tin lớp, lịch học, giảng viên, mã học viên.
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(401, detail="User not authenticated")

    try:
        enroll_res = supabase.table("enrollments").select(
            "id, student_code, status, class_name, schedule, instructor, "
            "enrolled_at, email_sent, email_sent_at, "
            "products(id, name, image_url, img, cat, duration, instructor, rating)"
        ).eq("user_id", user_id).order("enrolled_at", desc=True).execute()

        enrollments = enroll_res.data or []

        return {
            "status": "success",
            "enrollments": enrollments,
            "total_count": len(enrollments),
        }

    except Exception as e:
        raise HTTPException(500, detail=f"Database error: {str(e)}")


# ── GET /profile/me ────────────────────────────────────────────
@router.get("/me", summary="Thông tin cá nhân user")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    """Lấy thông tin profile của user hiện tại"""
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(401, detail="User not authenticated")

    try:
        user_res = supabase.table("users").select(
            "id, username, email, phone, full_name, avatar_url, "
            "dob, gender, address, city, bio, membership_tier, "
            "order_count, total_spent, created_at"
        ).eq("id", user_id).maybe_single().execute()

        if not user_res.data:
            raise HTTPException(404, detail="User not found")

        user = user_res.data

        # Map membership tier to display name
        tier_map = {
            'new': {'name': 'Khách mới', 'color': '#999', 'icon': '👤'},
            'silver': {'name': 'Bạc', 'color': '#c0c0c0', 'icon': '⭐'},
            'gold': {'name': 'Vàng', 'color': '#ffc107', 'icon': '✨'},
            'diamond': {'name': 'Kim cương', 'color': '#a8d8ff', 'icon': '💎'},
        }
        tier_info = tier_map.get(user.get('membership_tier', 'new'), tier_map['new'])

        return {
            "status": "success",
            "user": {
                **user,
                "membership_tier_info": tier_info,
            },
        }

    except Exception as e:
        raise HTTPException(500, detail=f"Database error: {str(e)}")


# ── PUT /profile/me ────────────────────────────────────────────
@router.put("/me", summary="Cập nhật thông tin cá nhân")
async def update_user_profile(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Cập nhật thông tin profile user.
    Chỉ cho phép update: full_name, phone, dob, gender, bio, city, address
    """
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(401, detail="User not authenticated")

    # Whitelist fields
    allowed_fields = {
        'full_name', 'phone', 'dob', 'gender',
        'bio', 'city', 'address', 'avatar_url',
    }
    update_data = {k: v for k, v in body.items() if k in allowed_fields and v is not None}

    if not update_data:
        raise HTTPException(400, detail="No fields to update")

    try:
        update_data['updated_at'] = 'now()'  # Supabase will handle this
        result = supabase.table("users").update(update_data).eq("id", user_id).execute()

        if not result.data:
            raise HTTPException(500, detail="Update failed")

        return {
            "status": "success",
            "message": "Profile updated",
            "user": result.data[0],
        }

    except Exception as e:
        raise HTTPException(500, detail=f"Database error: {str(e)}")


# ── GET /profile/stats ────────────────────────────────────────
@router.get("/stats", summary="Thống kê mua hàng")
async def get_user_stats(current_user: dict = Depends(get_current_user)):
    """Thống kê: số đơn hàng, tổng chi tiêu, khóa học, v.v."""
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(401, detail="User not authenticated")

    try:
        # Orders count & total spent
        user_res = supabase.table("users").select(
            "order_count, total_spent, membership_tier"
        ).eq("id", user_id).maybe_single().execute()

        user_stats = user_res.data or {}

        # Enrollments count
        enroll_res = supabase.table("enrollments").select("id", count="exact").eq(
            "user_id", user_id
        ).eq("status", "active").execute()

        # Recent order
        recent_order_res = supabase.table("orders").select(
            "created_at"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(1).maybe_single().execute()

        return {
            "status": "success",
            "stats": {
                "order_count": user_stats.get("order_count", 0),
                "total_spent": user_stats.get("total_spent", 0),
                "active_enrollments": enroll_res.count or 0,
                "membership_tier": user_stats.get("membership_tier", "new"),
                "last_order_date": recent_order_res.data.get("created_at") if recent_order_res.data else None,
            },
        }

    except Exception as e:
        raise HTTPException(500, detail=f"Database error: {str(e)}")