from pydantic import BaseModel, EmailStr,HttpUrl
from typing import Optional, Dict, Any
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

class ProductResponse(BaseModel):
    id: int
    name: str
    description: str
    price: Optional[float] = None
    brand: Optional[str] = None
    image_url: Optional[str] = None
    cat: Optional[str] = None
    badge: Optional[str] = None
    orig: Optional[float] = None
    img: Optional[str] = None
    rating: Optional[float] = None
    reviews: Optional[int] = None
    specs: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True  