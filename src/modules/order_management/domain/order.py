import uuid
from datetime import datetime
from typing import List
from .value_objects import OrderStatus, DeliveryInfo, OrderItemLine, Money

class OrderCreatedEvent:
    def __init__(self, order_id: str):
        self.order_id = order_id
        self.occurred_on = datetime.now()

class Order:
    def __init__(self, customer_id: str, delivery_info: DeliveryInfo):
        self.id = str(uuid.uuid4())
        self.customer_id = customer_id
        self.status = OrderStatus.PENDING
        self.delivery_info = delivery_info
        self.items: List[OrderItemLine] = []
        self.created_at = datetime.now()
        self.domain_events = []

    def add_item(self, item: OrderItemLine):
        self.items.append(item)

    def get_total(self) -> Money:
        total = sum(item.quantity * item.unit_price.amount for item in self.items)
        return Money(amount=total)

    def mark_as_paid(self):
        self.status = OrderStatus.PAID

    def finalize_creation(self):
        self.domain_events.append(OrderCreatedEvent(self.id))