from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional

# Import Use Case và Interface/Class từ các tầng khác
from ..application.use_cases.create_order import CreateOrderUseCase
from ..infrastructure.database.order_repo import SupabaseOrderRepository

class ItemDTO(BaseModel):
    product_id: int              # DB là int8
    product_name: str
    quantity: int
    price_at_purchase: float

class CreateOrderRequest(BaseModel):
    user_id: int                 # DB là int4
    receiver_name: str
    receiver_phone: str
    receiver_email: Optional[str] = None
    receiver_address: str
    note: Optional[str] = None
    pay_method: str
    subtotal: int                # DB là int8
    discount: int = 0
    ship_fee: int = 0
    total: int

router = APIRouter()

def get_create_order_use_case():
    from supabase import create_client
    supabase = create_client("SUPABASE_URL", "SUPABASE_KEY")

    repo = SupabaseOrderRepository(supabase)
    return CreateOrderUseCase(repo)

@router.post("/orders")
def create_order(
    request: CreateOrderRequest, 
    use_case: CreateOrderUseCase = Depends(get_create_order_use_case)
):
    try:
        print("Đã nhận data:", request.model_dump())
        
        return {
            "status": "success",
            "message": "Đơn hàng đã được tạo thành công!",
            "data": { 
                "order_id": "OD-12345", 
                "total": request.total,
                "receiver": request.receiver_name
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))