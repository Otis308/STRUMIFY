from fastapi import APIRouter, Depends, HTTPException
from supabase import create_client, Client
import os

from ..application.use_cases import CreateOrderUseCase, CreateOrderRequestDTO, CreateOrderResponseDTO
from ..domain.repositories import OrderDomainException
from ..infrastructure.database.order_repo import SupabaseOrderRepository, SupabaseProductRepository

router = APIRouter(prefix="/orders", tags=["Order Management"])

# --- Dependency Injection setup ---
# Trong thực tế, bạn nên đặt hàm này vào một file dependencies.py riêng ở cấp module
def get_supabase_client() -> Client:
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_KEY")
    return create_client(url, key)

def get_create_order_usecase(
    supabase: Client = Depends(get_supabase_client)
) -> CreateOrderUseCase:
    order_repo = SupabaseOrderRepository(supabase)
    product_repo = SupabaseProductRepository(supabase)
    return CreateOrderUseCase(order_repo=order_repo, product_repo=product_repo)


# --- Endpoint ---
@router.post("/", response_model=CreateOrderResponseDTO, status_code=201)
def create_order(
    request: CreateOrderRequestDTO, 
    use_case: CreateOrderUseCase = Depends(get_create_order_usecase)
):
    try:
        # Trả về kết quả trực tiếp từ Use Case
        return use_case.execute(request)
        
    except OrderDomainException as e:
        # Bắt lỗi Business Logic từ Domain/Application và chuyển thành HTTP 400
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Lỗi hệ thống (database timeout, v.v.)
        raise HTTPException(status_code=500, detail="Lỗi máy chủ nội bộ. Vui lòng thử lại sau.")