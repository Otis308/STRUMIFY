import sqlite3
import bcrypt

print("Đang tạo tài khoản Admin...")

# 1. Tự động băm mật khẩu luôn cho tiện
my_password = b"Admin@Moc2024!"
salt = bcrypt.gensalt()
hashed_password = bcrypt.hashpw(my_password, salt).decode('utf-8')

# 2. Kết nối trực tiếp vào file database SQLite của bạn
# (Đảm bảo file này tên là guitar.db và nằm cùng thư mục với script này)
try:
    conn = sqlite3.connect('guitar.db')
    cursor = conn.cursor()

    # 3. Dùng câu lệnh INSERT chuẩn xác với Model của bạn
    cursor.execute("""
        INSERT INTO users (username, email, password_hash, role)
        VALUES (?, ?, ?, ?)
    """, ('admin_moc', 'admin@mocguitar.vn', hashed_password, 'admin'))

    # Lưu thay đổi
    conn.commit()
    print("✅ Xong! Đã tạo tài khoản Admin thành công vào file guitar.db!")

except sqlite3.IntegrityError:
    print("⚠️ Tài khoản admin (email hoặc username) này đã tồn tại rồi.")
except sqlite3.OperationalError as e:
    print(f"❌ Lỗi Database: {e}. (Có thể bảng users chưa được tạo trong file guitar.db)")
finally:
    if conn:
        conn.close()