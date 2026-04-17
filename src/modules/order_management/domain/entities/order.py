from dataclasses import dataclass, field
from typing import List
import uuid

@dataclass
class OrderItem:
    product_id: str
    price: float
    quantity: int

@dataclass
class Order:
    customer_id: str
    items: List[OrderItem]
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "PENDING"
    
    # Nghiệp vụ (Business Logic) nằm ở đây
    def get_total_price(self) -> float:
        if not self.items:
            raise ValueError("Đơn hàng không được trống!")
        return sum(item.price * item.quantity for item in self.items)
