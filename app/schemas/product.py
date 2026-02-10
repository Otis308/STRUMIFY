from pydantic import BaseModel, EmailStr,HttpUrl
from typing import Optional, List
from datetime import datetime

class ProductBase(BaseModel):
    name : str
    price : float
    description : Optional[str] = None
    brand : str
    image_url : HttpUrl

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    image_url: HttpUrl

class ProductResponse(ProductBase):
    id : int

    class Config:
        from_attributes = True