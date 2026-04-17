"""
app/routers/products.py – Strumify
✅ Fix: clean giá trị None thành null (không trả string "None" về frontend)
✅ Fix: image_url ưu tiên trước img
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from src.shared.supabase_client import supabase
from src.shared.security import require_admin

router = APIRouter(prefix="/products", tags=["Products"])


def clean(value):
    """Chuyển Python None và string 'None' thành None (JSON null)."""
    if value is None:
        return None
    if isinstance(value, str) and value.strip().lower() in ('none', 'null', ''):
        return None
    return value


def normalize_product(p: dict) -> dict:
    """
    Chuẩn hóa sản phẩm trước khi trả về frontend:
    - image_url ưu tiên trước img
    - Xóa hết giá trị "None" string
    """
    # Chuẩn hóa ảnh: luôn dùng image_url, xóa field img thừa
    image_url = clean(p.get("image_url")) or clean(p.get("img")) or None
    p["image_url"] = image_url

    # Clean tất cả field string khác
    for key in ("name", "description", "cat", "brand", "badge"):
        p[key] = clean(p.get(key))

    # Đảm bảo số không bị None
    p["price"]   = float(p["price"])  if p.get("price")   is not None else 0
    p["orig"]    = float(p["orig"])   if p.get("orig")     is not None else None
    p["rating"]  = float(p["rating"]) if p.get("rating")   is not None else None
    p["reviews"] = int(p["reviews"])  if p.get("reviews")  is not None else 0

    return p


# ── LẤY TẤT CẢ SẢN PHẨM ─────────────────────────────────────────
@router.get("/")
async def get_products(
    skip:      int = Query(0,   ge=0),
    limit:     int = Query(500, ge=1, le=500),
    cat:       Optional[str]   = None,
    brand:     Optional[str]   = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    search:    Optional[str]   = None,
):
    query = supabase.table("products").select(
        "id, name, description, cat, brand, badge, "
        "price, orig, image_url, img, rating, reviews, specs, created_at"
    )

    if cat:       query = query.eq("cat", cat)
    if brand:     query = query.ilike("brand", f"%{brand}%")
    if min_price: query = query.gte("price", min_price)
    if max_price: query = query.lte("price", max_price)
    if search:    query = query.ilike("name", f"%{search}%")

    res = query.range(skip, skip + limit - 1).order("id").execute()
    return [normalize_product(p) for p in (res.data or [])]


# ── LẤY 1 SẢN PHẨM ───────────────────────────────────────────────
@router.get("/{product_id}")
async def get_product(product_id: int):
    res = supabase.table("products").select("*").eq("id", product_id).maybe_single().execute()
    if not res.data:
        raise HTTPException(404, detail="Sản phẩm không tìm thấy.")
    return normalize_product(res.data)


# ── ADMIN: TẠO SẢN PHẨM ──────────────────────────────────────────
@router.post("/bulk", status_code=201)
async def create_products_bulk(
    items: list[dict],
    admin: dict = Depends(require_admin),
):
    if not items:
        raise HTTPException(400, detail="Danh sách sản phẩm trống.")

    cleaned = []
    for item in items:
        # Normalize ảnh: gộp vào image_url
        item["image_url"] = item.get("image_url") or item.get("img") or None
        item.pop("img", None)
        cleaned.append(item)

    res = supabase.table("products").insert(cleaned).execute()
    if not res.data:
        raise HTTPException(500, detail="Không thể tạo sản phẩm.")
    return {"status": "success", "created": len(res.data)}


# ── ADMIN: CẬP NHẬT SẢN PHẨM ─────────────────────────────────────
@router.put("/{product_id}")
async def update_product(
    product_id: int,
    updates: dict,
    admin: dict = Depends(require_admin),
):
    if "img" in updates:
        updates["image_url"] = updates.pop("img")
    res = supabase.table("products").update(updates).eq("id", product_id).execute()
    if not res.data:
        raise HTTPException(404, detail="Sản phẩm không tìm thấy.")
    return normalize_product(res.data[0])


# ── ADMIN: XÓA SẢN PHẨM ──────────────────────────────────────────
@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    admin: dict = Depends(require_admin),
):
    supabase.table("products").delete().eq("id", product_id).execute()