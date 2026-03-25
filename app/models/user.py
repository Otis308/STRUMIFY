from app.database.database import Base
from sqlalchemy import Integer, String, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import List

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False) 
    role: Mapped[str] = mapped_column(String(20), default="user")
#Realtionship
    orders: Mapped[List["Order"]] = relationship(back_populates="user")

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    
    # Dùng TÊN CLASS dạng chuỗi "Order"
    orders = relationship("Order", back_populates="user")