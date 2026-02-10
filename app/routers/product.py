from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select  
from typing import List

# --- CÁC IMPORT CHUẨN ---
from app.database.database import get_db
from app.schemas.product import ProductCreate, ProductResponse
from app.models.product import Product 
router = APIRouter(
    prefix = "/guitars",
    tags = ["Guitars"]
) 

@router.post("/bulk", status_code=status.HTTP_201_CREATED, response_model=List[ProductResponse])
async def create_bulk_guitars(request_body: List[ProductCreate], db: AsyncSession = Depends(get_db)):
    new_products = []
    
    for item in request_body:
        str_image_url = str(item.image_url) if item.image_url else None
        
        product = Product(
            name=item.name,
            price=item.price,
            description=item.description,
            brand=item.brand,
            image_url=str_image_url
        )
        new_products.append(product)
        db.add(product) 

    await db.commit()
    return new_products

@router.get("/", response_model=List[ProductResponse])
async def get_all_guitars(skip: int = 0, limit: int = 10, db: AsyncSession = Depends(get_db)):

    query = select(Product).offset(skip).limit(limit)
    result = await db.execute(query) 
    guitars = result.scalars().all()

    return guitars