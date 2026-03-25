from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator
import re

class User(BaseModel):
    username: str
    email : EmailStr
    phone: str = Field(..., description="Số điện thoại Việt Nam")

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        phone_regex = r"^(0|\+84)[3|5|7|8|9][0-9]{8}$"
        if not re.match(phone_regex, v):
            raise ValueError('Số điện thoại không đúng định dạng Việt Nam')
        return v
    
class UserCreate(User):
    password: str = Field(..., min_length=8)

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        password_regex = r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$"
        if not re.match(password_regex, v):
            raise ValueError('Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt')
        return v

class UserResponse(BaseModel):
    id: str
    role: str
    model_config = ConfigDict(from_attributes=True)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

