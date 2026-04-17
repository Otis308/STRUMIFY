"""
routers/rout_cart.py – Strumify
Giỏ hàng server-side: Mỗi user có giỏ hàng riêng, lưu trên DB.

Endpoints:
  GET  /cart/          → Lấy giỏ hàng của user hiện tại
  POST /cart/add       → Thêm / cộng dồn số lượng (Shopee-style)
  PUT  /cart/{id}      → Cập nhật số lượng 1 item
  DELETE /cart/{id}    → Xóa 1 item
  DELETE /cart/clear   → Xóa toàn bộ giỏ hàng
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel, Field

from src.shared.supabase_client import supabase
from src.shared.security import get_current_user

router = APIRouter(prefix="/cart", tags=["Cart"])


# ── SCHEMAS ──────────────────────────────────────────────────────
class AddToCartRequest(BaseModel):
    product_id: int
    quantity:   int = Field(default=1, ge=1, le=100)


class UpdateCartItemRequest(BaseModel):
    quantity: int = Field(ge=1, le=100)


class CartItemResponse(BaseModel):
    id:           int
    product_id:   int
    quantity:     int
    product_name: str
    product_type: str          # 'product' | 'course'
    price:        float
    image_url:    Optional[str]
    cat:          Optional[str]
    line_total:   float


# ── HELPER ───────────────────────────────────────────────────────
def _format_item(row: dict) -> CartItemResponse:
    p = row.get("products") or {}
    price = float(p.get("price") or 0)
    qty   = int(row.get("quantity") or 1)
    return CartItemResponse(
        id           = row["id"],
        product_id   = row["product_id"],
        quantity     = qty,
        product_name = p.get("name")         or "",
        product_type = p.get("product_type") or "product",
        price        = price,
        image_url    = p.get("image_url") or p.get("img") or None,
        cat          = p.get("cat") or None,
        line_total   = price * qty,
    )


# ── GET /cart/ ───────────────────────────────────────────────────
@router.get("/", summary="Lấy giỏ hàng của user hiện tại")
async def get_cart(current_user: dict = Depends(get_current_user)):
    """
    Trả về toàn bộ sản phẩm trong giỏ hàng của user đang đăng nhập.
    User A không bao giờ thấy giỏ hàng User B.
    """
    res = supabase.table("cart_items").select(
        "id, product_id, quantity, "
        "products(id, name, product_type, price, image_url, img, cat, badge)"
    ).eq("user_id", current_user["id"]).execute()

    items      = [_format_item(r) for r in (res.data or [])]
    subtotal   = sum(i.line_total for i in items)
    item_count = sum(i.quantity   for i in items)

    return {
        "items":      [i.model_dump() for i in items],
        "item_count": item_count,
        "subtotal":   subtotal,
    }


# ── POST /cart/add ───────────────────────────────────────────────
@router.post("/add", summary="Thêm vào giỏ / cộng dồn số lượng (Shopee-style)")
async def add_to_cart(
    body: AddToCartRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Logic Shopee:
    - Nếu sản phẩm ĐÃ có trong giỏ → cộng dồn quantity
    - Nếu CHƯA có → tạo bản ghi mới
    Giỏ hàng gắn với user_id → hoàn toàn cách ly giữa các tài khoản.
    """
    user_id    = current_user["id"]
    product_id = body.product_id
    qty_add    = body.quantity

    # 1. Kiểm tra sản phẩm tồn tại
    prod_res = supabase.table("products").select(
        "id, name, price, product_type, is_active"
    ).eq("id", product_id).maybe_single().execute()

    if not prod_res.data:
        raise HTTPException(404, detail="Sản phẩm không tồn tại.")

    prod = prod_res.data
    if prod.get("is_active") is False:
        raise HTTPException(400, detail="Sản phẩm hiện không còn bán.")

    # 2. Kiểm tra đã có trong giỏ chưa
    existing = supabase.table("cart_items").select("id, quantity").eq(
        "user_id", user_id
    ).eq("product_id", product_id).maybe_single().execute()

    if existing.data:
        # Cộng dồn số lượng
        new_qty = existing.data["quantity"] + qty_add
        supabase.table("cart_items").update(
            {"quantity": new_qty}
        ).eq("id", existing.data["id"]).execute()

        return {
            "action":   "updated",
            "message":  f"Đã cập nhật số lượng thành {new_qty}",
            "quantity": new_qty,
        }
    else:
        # Thêm mới
        supabase.table("cart_items").insert({
            "user_id":    user_id,
            "product_id": product_id,
            "quantity":   qty_add,
        }).execute()

        return {
            "action":   "added",
            "message":  f"Đã thêm {prod['name']} vào giỏ hàng",
            "quantity": qty_add,
        }


# ── PUT /cart/{item_id} ──────────────────────────────────────────
@router.put("/{item_id}", summary="Cập nhật số lượng 1 sản phẩm")
async def update_cart_item(
    item_id: int,
    body:    UpdateCartItemRequest,
    current_user: dict = Depends(get_current_user),
):
    # Xác minh item thuộc về user hiện tại
    item = supabase.table("cart_items").select("id, user_id").eq(
        "id", item_id
    ).maybe_single().execute()

    if not item.data:
        raise HTTPException(404, detail="Không tìm thấy sản phẩm trong giỏ hàng.")
    if item.data["user_id"] != current_user["id"]:
        raise HTTPException(403, detail="Bạn không có quyền sửa item này.")

    supabase.table("cart_items").update(
        {"quantity": body.quantity}
    ).eq("id", item_id).execute()

    return {"message": f"Đã cập nhật số lượng thành {body.quantity}"}


# ── DELETE /cart/clear ───────────────────────────────────────────
@router.delete("/clear", summary="Xóa toàn bộ giỏ hàng")
async def clear_cart(current_user: dict = Depends(get_current_user)):
    supabase.table("cart_items").delete().eq(
        "user_id", current_user["id"]
    ).execute()
    return {"message": "Đã xóa toàn bộ giỏ hàng."}


# ── DELETE /cart/{item_id} ───────────────────────────────────────
@router.delete("/{item_id}", summary="Xóa 1 sản phẩm khỏi giỏ")
async def remove_cart_item(
    item_id: int,
    current_user: dict = Depends(get_current_user),
):
    item = supabase.table("cart_items").select("id, user_id").eq(
        "id", item_id
    ).maybe_single().execute()

    if not item.data:
        raise HTTPException(404, detail="Không tìm thấy item.")
    if item.data["user_id"] != current_user["id"]:
        raise HTTPException(403, detail="Bạn không có quyền xóa item này.")

    supabase.table("cart_items").delete().eq("id", item_id).execute()
    return {"message": "Đã xóa sản phẩm khỏi giỏ hàng."}