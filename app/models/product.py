from database import Base
from sqlalchemy import Integer, String, Float, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from  typing import Optional, List
from models.order import Order

class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    description:  Mapped[str] = mapped_column(Text, nullable=False)
    brand: Mapped[str] = mapped_column(String(100), nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
#Relationship
    orders: Mapped[List["Order"]] = relationship(back_populates="product")