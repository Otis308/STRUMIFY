from pydantic import BaseModel
from typing import List
from ..domain.order import Order
from ..domain.value_objects import DeliveryInfo, OrderItemLine, Money
from ..domain.repositories import OrderRepository, ProductRepository, OrderDomainException

# --- DTOs (Data Transfer Objects) ---
class OrderItemDTO(BaseModel):
    product_id: str
    quantity: int

class CreateOrderRequestDTO(BaseModel):
    customer_id: str
    recipient_name: str
    phone_number: str
    address: str
    items: List[OrderItemDTO]

class CreateOrderResponseDTO(BaseModel):
    order_id: str
    total_amount: float
    status: str

# --- Use Case ---
class CreateOrderUseCase:
    def __init__(self, order_repo: OrderRepository, product_repo: ProductRepository):
        self.order_repo = order_repo
        self.product_repo = product_repo

    def execute(self, request: CreateOrderRequestDTO) -> CreateOrderResponseDTO:
        if not request.items:
            raise OrderDomainException("Đơn hàng phải có ít nhất 1 sản phẩm.")

        # 1. Khởi tạo Domain Object
        delivery_info = DeliveryInfo(
            recipient_name=request.recipient_name,
            phone_number=request.phone_number,
            address=request.address
        )
        order = Order(customer_id=request.customer_id, delivery_info=delivery_info)

        # 2. Xử lý logic nghiệp vụ và thêm Item
        for item_dto in request.items:
            # Gọi Port để check kho
            if not self.product_repo.check_stock(item_dto.product_id, item_dto.quantity):
                raise OrderDomainException(f"Sản phẩm {item_dto.product_id} không đủ số lượng trong kho.")
            
            # Gọi Port để lấy giá mới nhất
            price = self.product_repo.get_price(item_dto.product_id)
            
            order_item = OrderItemLine(
                product_id=item_dto.product_id,
                quantity=item_dto.quantity,
                unit_price=Money(amount=price)
            )
            order.add_item(order_item)

        # 3. Hoàn tất và lưu trữ
        order.finalize_creation()
        self.order_repo.save(order) # Lưu vào Supabase qua Adapter
        
        # (Tùy chọn) Có thể publish các sự kiện trong order.domain_events ở đây

        # 4. Trả về kết quả
        return CreateOrderResponseDTO(
            order_id=order.id,
            total_amount=order.get_total().amount,
            status=order.status.value
        )