from abc import ABC, abstractmethod
from ..entities.order import Order

class IOrderRepository(ABC):
    @abstractmethod
    def save(self, order: Order) -> Order:
        """Lưu order xuống DB"""
        pass
