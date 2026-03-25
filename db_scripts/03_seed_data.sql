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

GRANT TEMPORARY, CONNECT ON DATABASE guitarshop TO PUBLIC;

GRANT ALL ON DATABASE guitarshop TO postgres;

GRANT CONNECT ON DATABASE guitarshop TO team_intern;

GRANT CONNECT ON DATABASE guitarshop TO team_sales;

GRANT CONNECT ON DATABASE guitarshop TO team_tech;

-- Làm sạch dữ liệu cũ
TRUNCATE TABLE orders, products, users RESTART IDENTITY CASCADE;

-- Thêm 5 Users
INSERT INTO users (username, email, password_hash, role) VALUES
('admin_guitar', 'admin@guitar.com', 'hash123', 'admin'),
('customer_a', 'a@gmail.com', 'hash123', 'user'),
('customer_b', 'b@gmail.com', 'hash123', 'user'),
('customer_c', 'c@gmail.com', 'hash123', 'user'),
('customer_d', 'd@gmail.com', 'hash123', 'user');

-- Thêm 15 Products (Ảnh thật Unsplash)
INSERT INTO products (name, price, description, brand, image_url) VALUES
('Fender Strat', 1200, 'Classic Sunburst', 'Fender', 'https://images.unsplash.com/photo-1564186763531-64147f60e3c3?w=500'),
('Gibson LP', 2000, 'Gold Top heavy sound', 'Gibson', 'https://images.unsplash.com/photo-1550985543-f4423c8d32ec?w=500'),
('Taylor 214', 1100, 'Acoustic Bright', 'Taylor', 'https://images.unsplash.com/photo-1556449895-a33c9dfd3f6d?w=500'),
('Martin D28', 3000, 'Deep acoustic bass', 'Martin', 'https://images.unsplash.com/photo-1510915361405-ef8a4d519f2d?w=500'),
('Ibanez RG', 800, 'Fast neck electric', 'Ibanez', 'https://images.unsplash.com/photo-1550291652-6ea9114a47b1?w=500'),
('Yamaha C40', 140, 'Classic for student', 'Yamaha', 'https://images.unsplash.com/photo-1588449668365-d15e391f32f8?w=500'),
('Epiphone SG', 450, 'Rock style black', 'Epiphone', 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=500'),
('PRS Custom', 2500, 'Luxury look electric', 'PRS', 'https://images.unsplash.com/photo-1599507986064-a0c47683935a?w=500'),
('Squier Tele', 350, 'Vintage white', 'Squier', 'https://images.unsplash.com/photo-1558098329-a11cff621064?w=500'),
('Gretsch Falcon', 3400, 'White hollow body', 'Gretsch', 'https://images.unsplash.com/photo-1549420695-816766439063?w=500'),
('Takamine G', 380, 'Acoustic natural', 'Takamine', 'https://images.unsplash.com/photo-1605020420620-20c943cc4669?w=500'),
('Schecter Metal', 700, 'High gain pickups', 'Schecter', 'https://images.unsplash.com/photo-1525201548942-d8732f6617a0?w=500'),
('Sterling Bass', 650, 'Blue electric bass', 'Sterling', 'https://images.unsplash.com/photo-1566937243916-1f6b5535c5c8?w=500'),
('Cordoba C5', 300, 'Classical nylon', 'Cordoba', 'https://images.unsplash.com/photo-1516924912317-7348984906f6?w=500'),
('Jackson Solo', 950, 'Pointy headstock', 'Jackson', 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=500');

-- Thêm 20 Orders ngẫu nhiên
INSERT INTO orders (user_id, product_id, quantity, price_at_purchase, status) VALUES
(2,1,1,1200,'shipped'), (2,5,1,800,'pending'), (3,2,1,2000,'completed'), (3,10,1,3400,'delivered'),
(4,3,1,1100,'processing'), (4,8,1,2500,'shipped'), (5,15,1,950,'pending'), (5,7,1,450,'completed'),
(2,12,1,700,'shipped'), (3,4,1,3000,'delivered'), (4,11,1,380,'processing'), (5,6,2,280,'completed'),
(2,9,1,350,'pending'), (3,1,1,1200,'shipped'), (4,13,1,650,'delivered'), (5,14,1,300,'completed'),
(2,2,1,2000,'processing'), (3,3,1,1100,'pending'), (4,5,1,800,'shipped'), (5,10,1,3400,'delivered');

select * from products