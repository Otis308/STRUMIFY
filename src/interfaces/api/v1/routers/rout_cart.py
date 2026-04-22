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

import json
import time
from pathlib import Path
from typing import List, Optional, Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel, Field

from src.shared.supabase_client import supabase
from src.shared.security import get_current_user

router = APIRouter(prefix="/cart", tags=["Cart"])

_PROJECT_ROOT = Path(__file__).resolve().parents[5]
_DEBUG_LOG_PATH = str(_PROJECT_ROOT / "debug-368463.log")
_DEBUG_SESSION_ID = "368463"


def _dbg_log(*, run_id: str, hypothesis_id: str, location: str, message: str, data: dict) -> None:
    try:
        payload = {
            "sessionId": _DEBUG_SESSION_ID,
            "runId": run_id,
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
        }
        with open(_DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    except Exception:
        pass


# ── SCHEMAS ──────────────────────────────────────────────────────
class AddToCartRequest(BaseModel):
    product_id: int
    quantity:   int = Field(default=1, ge=1, le=100)
    product_type: Optional[Literal["product", "course"]] = None


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
    body: AddToCartRequest,
    current_user: dict = Depends(get_current_user),
):
    """Thêm sản phẩm vào giỏ"""
    user_id = current_user["id"]
    product_id = body.product_id
    quantity = body.quantity

    # #region agent log
    _dbg_log(
        run_id="pre-fix",
        hypothesis_id="B1",
        location="rout_cart.py:add_to_cart:entry",
        message="Add to cart request parsed",
        data={
            "user_id": user_id,
            "product_id": product_id,
            "quantity": quantity,
        },
    )
    # #endregion
    
    try:
        product_res = supabase.table("products").select("id, product_type").eq(
            "id", product_id
        ).maybe_single().execute()
        product_data = product_res.data or {}
        if not product_data:
            raise HTTPException(status_code=404, detail="Sản phẩm/khóa học không tồn tại.")

        db_product_type = (product_data.get("product_type") or "product").lower()
        if body.product_type and body.product_type != db_product_type:
            raise HTTPException(
                status_code=400,
                detail="Loại sản phẩm không hợp lệ với dữ liệu hệ thống.",
            )

        # Kiểm tra sản phẩm đã tồn tại?
        existing = supabase.table("cart_items").select("id, quantity").eq(
            "user_id", user_id
        ).eq("product_id", product_id).maybe_single().execute()
        existing_data = getattr(existing, "data", None) if existing is not None else None

        # #region agent log
        _dbg_log(
            run_id="pre-fix",
            hypothesis_id="B2",
            location="rout_cart.py:add_to_cart:existing",
            message="Existing cart item lookup",
            data={
                "existing_type": type(existing).__name__ if existing is not None else None,
                "has_data": bool(getattr(existing, "data", None)),
                "data_keys": sorted(list(existing_data.keys())) if isinstance(existing_data, dict) else None,
            },
        )
        # #endregion

        if isinstance(existing_data, dict) and existing_data:
            # Update quantity
            new_qty = int(existing_data.get("quantity") or 0) + quantity
            upd = supabase.table("cart_items").update({
                "quantity": new_qty
            }).eq("id", existing_data["id"]).execute()

            # #region agent log
            _dbg_log(
                run_id="pre-fix",
                hypothesis_id="B3",
                location="rout_cart.py:add_to_cart:update",
                message="Updated cart item quantity",
                data={"updated_rows": len(upd.data or [])},
            )
            # #endregion
        else:
            ins = supabase.table("cart_items").insert({
                "user_id": user_id,
                "product_id": product_id,
                "quantity": quantity,
            }).execute()

            # #region agent log
            _dbg_log(
                run_id="pre-fix",
                hypothesis_id="B4",
                location="rout_cart.py:add_to_cart:insert",
                message="Inserted cart item",
                data={"inserted_rows": len(ins.data or [])},
            )
            # #endregion

        return {"status": "success", "message": "Added to cart"}
    except HTTPException:
        raise
    except Exception as e:
        # #region agent log
        _dbg_log(
            run_id="pre-fix",
            hypothesis_id="B5",
            location="rout_cart.py:add_to_cart:exception",
            message="Unhandled exception in /cart/add",
            data={"error": str(e), "error_type": type(e).__name__},
        )
        # #endregion
        raise HTTPException(status_code=500, detail="Internal Server Error")


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
