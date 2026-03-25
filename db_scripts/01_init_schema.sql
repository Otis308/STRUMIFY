-- Database: guitarshop

-- DROP DATABASE IF EXISTS guitarshop;

CREATE DATABASE guitarshop
    WITH
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'English_United States.1252'
    LC_CTYPE = 'English_United States.1252'
    LOCALE_PROVIDER = 'libc'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1
    IS_TEMPLATE = False;

-- 1. Tạo bảng users (Dùng số nhiều để tránh trùng từ khóa 'user' của hệ thống)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    role VARCHAR(20) DEFAULT 'user'
);

-- 2. Tạo bảng products
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    price FLOAT,
    description TEXT NOT NULL,
    brand VARCHAR(100) NOT NULL,
    image_url VARCHAR(500)
);

-- 3. Tạo bảng orders (Đây là nơi bạn gặp lỗi LINE 13)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    quantity INTEGER DEFAULT 1,
    price_at_purchase FLOAT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    
    -- SỬA LỖI TẠI ĐÂY: Phải là 'users' (số nhiều) để khớp với bảng đã tạo ở trên
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Đánh index như trong code SQLAlchemy của bạn
CREATE INDEX IF NOT EXISTS ix_users_id ON users (id);
CREATE INDEX IF NOT EXISTS ix_orders_id ON orders (id);