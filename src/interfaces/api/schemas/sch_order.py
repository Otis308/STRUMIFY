from pydantic import BaseModel
from datetime import datetime 
from schemas.sch_product import ProductResponse

from typing import Optional

class OrderCreate(BaseModel):
    product_id: int
    quantity: int = 1

class OrderResponse(BaseModel):
    id : int
    user_id : int
    product_id : int
    quantity : int
    price_at_purchase : float
    status : str
    created_at : datetime
    product : Optional[ProductResponse] = None

    class Config:
        from_attributes = True