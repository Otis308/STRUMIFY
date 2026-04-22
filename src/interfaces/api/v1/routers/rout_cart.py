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
@router.get("/", tags=["Cart"])
async def get_cart(current_user: dict = Depends(get_current_user)):
    """Lấy giỏ hàng hiện tại"""
    res = supabase.table("cart_items").select(
        "id, product_id, quantity, "
        "products(id, name, price, image_url, cat, product_type)" 
    ).eq("user_id", current_user["id"]).execute()
    
    formatted_items = [_format_item(row) for row in (res.data or [])]
    
    return {
        "items": formatted_items,
        "total": sum(item.quantity for item in formatted_items)
    }

# ── POST /cart/add ───────────────────────────────────────────────
@router.post("/add", tags=["Cart"])
async def add_to_cart(
    product_id: int,
    quantity: int = 1,
    current_user: dict = Depends(get_current_user),
):
    """Thêm sản phẩm vào giỏ"""
    user_id = current_user["id"]
    
    # Kiểm tra sản phẩm đã tồn tại?
    existing = supabase.table("cart_items").select("id, quantity").eq(
        "user_id", user_id
    ).eq("product_id", product_id).maybe_single().execute()
    
    if existing.data:
        # Update quantity
        new_qty = existing.data["quantity"] + quantity
        supabase.table("cart_items").update({
            "quantity": new_qty
        }).eq("id", existing.data["id"]).execute()
    else:
        # Insert mới
        supabase.table("cart_items").insert({
            "user_id": user_id,
            "product_id": product_id,
            "quantity": quantity,
        }).execute()
    
    return {"status": "success", "message": "Added to cart"}


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
@router.delete("/{item_id}", tags=["Cart"])
async def remove_from_cart(
    item_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Xóa sản phẩm khỏi giỏ"""
    supabase.table("cart_items").delete().eq("id", item_id).execute()
    return {"status": "success"}
