from passlib.context import CryptContext

# Khởi tạo thuật toán bcrypt (chuẩn chung của FastAPI)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Mật khẩu bạn muốn đặt cho Admin
my_password = "Admin@Moc2024!"

# Tạo mã hash
hashed_password = pwd_context.hash(my_password)

print("Mật khẩu gốc:", my_password)
print("Chuỗi Hash để lưu vào Database:", hashed_password)