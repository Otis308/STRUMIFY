from database import Base
from datetime import UTC, datetime
from sqlalchemy import DateTime, Integer, String, Float, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from  typing import Optional
from models.user import User
from models.product import Product

class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    price_at_purchase: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
#Foreignkey
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id"))
#Relationship
    user: Mapped["User"] = relationship(back_populates="orders")
    product: Mapped["Product"] = relationship()