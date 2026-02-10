from pydantic import BaseModel, EmailStr

class User(BaseModel):
    username: str
    email : EmailStr

class UserCreate(BaseModel):
    password : str

class UserResponse(BaseModel):
    id : int
    role : str

    class config: 
        from_attribute=True