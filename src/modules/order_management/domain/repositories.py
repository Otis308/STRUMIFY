from abc import ABC, abstractmethod
from typing import Optional
from .order import Order

class OrderDomainException(Exception):
    pass

class OrderRepository(ABC):
    @abstractmethod
    def save(self, order: Order) -> None:
        pass

    @abstractmethod
    def get_by_id(self, order_id: str) -> Optional[Order]:
        pass

class ProductRepository(ABC):
    @abstractmethod
    def get_price(self, product_id: str) -> float:
        pass
    
    @abstractmethod
    def check_stock(self, product_id: str, required_quantity: int) -> bool:
        pass