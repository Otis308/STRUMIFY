from enum import Enum
from dataclasses import dataclass

class OrderStatus(Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    SHIPPED = "SHIPPED"
    CANCELLED = "CANCELLED"

@dataclass(frozen=True)
class Money:
    amount: float
    currency: str = "VND"

@dataclass(frozen=True)
class DeliveryInfo:
    recipient_name: str
    phone_number: str
    address: str

@dataclass(frozen=True)
class OrderItemLine:
    product_id: str
    quantity: int
    unit_price: Money