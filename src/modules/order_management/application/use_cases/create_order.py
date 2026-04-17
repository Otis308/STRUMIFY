from ...domain.entities.order import Order, OrderItem
from ...domain.repositories.i_order_repository import IOrderRepository

class CreateOrderUseCase:
    # Dependency Injection: Nhận interface, không nhận class cụ thể
    def __init__(self, order_repo: IOrderRepository):
        self.order_repo = order_repo

    def execute(self, customer_id: str, items_data: list) -> dict:
        # 1. Chuyển đổi dữ liệu 
        items = [OrderItem(**item) for item in items_data]
        
        # 2. Tạo entity Domain
        order = Order(customer_id=customer_id, items=items)
        
        # 3. Kiểm tra nghiệp vụ 
        total = order.get_total_price()
        
        # 4. Lưu xuống Database thông qua Interface
        saved_order = self.order_repo.save(order)
        
        return {
            "order_id": saved_order.id,
            "total_amount": total,
            "status": saved_order.status
        }
