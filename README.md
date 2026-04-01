
# 🎸 Strumify - Guitar E-commerce 
A full-stack e-commerce web application for musical instruments, 
built with FastAPI + Supabase + Vanilla JS.

Features a complete shopping flow, real-time cart sync, JWT authentication, 
admin dashboard, repair booking system, and automated CI/CD pipeline via Docker + GitHub Actions.

## Badges
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white) 
![FastAPI](https://img.shields.io/badge/FastAPI-0.135-009688?logo=fastapi)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?logo=github-actions)
![JWT](https://img.shields.io/badge/Auth-JWT-orange)
![License](https://img.shields.io/badge/License-MIT-green)
## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | FastAPI (Python 3.11) | REST API, routing, business logic |
| **Database** | Supabase (PostgreSQL) | Cloud DB + Auth + Storage |
| **ORM** | SQLAlchemy 2.x | Async DB models |
| **Frontend** | HTML5 / CSS3 / Vanilla JS | Jinja2 server-side rendering |
| **Auth** | JWT + bcrypt (passlib) | Stateless authentication |
| **Deploy** | Vercel + Docker | Serverless + containerized |
| **CI/CD** | GitHub Actions | Auto build, test, push image |
| **Storage** | Supabase Storage | Product images, repair media |
| **Task Queue** | Celery + Redis | Async email/SMS notifications |
| **Email** | fastapi-mail (SMTP Gmail) | Password reset, order confirm |
## ✨ Core Features

### 🛒 E-Commerce
- Product catalog with 7+ categories (Guitar, Piano, Violin, Drum, Flute, Organ, Ukulele)
- Real-time search, category filter, multi-sort (price, badge, hot, new, limited)
- Shopping cart: localStorage (guest) → Supabase sync (logged-in user)
- Cart merge on login (guest cart → user account)
- Multi-step checkout (Cart → Info → Payment → Confirmation)
- VietQR bank transfer integration (auto-generate QR)
- Coupon/Voucher system (percent & fixed discount)
- Order tracking timeline (6-step status flow)

### 🔐 Authentication & User Management
- Register / Login with email + password
- JWT Bearer Token (7-day expiry)
- Forgot Password → Reset via email link (15-min expiry, SHA-256 hashed token)
- Membership tier system: New → Silver → Gold → Diamond
- Profile management (avatar, address, DOB, gender)

### 🛠 Admin Dashboard
- Sales overview: Revenue, Profit estimate, Total orders, Stock count
- Product CRUD (add, edit, delete, bulk insert)
- Order status management (processing → confirmed → shipping → delivered)
- Customer list with tier & spending stats
- Membership tier breakdown

### 🔧 Repair & Maintenance Booking
- 5-step workflow: Receive → Diagnose → Approve → Repair → Deliver
- Online booking form with image/video upload (max 5 files, 20MB each)
- Order tracking by code (real-time status + log history)
- Email + SMS notification on status change (Celery async tasks)
- Service catalog per instrument type
- Spare parts inventory management

### 📚 Education
- 15 music courses (Guitar, Piano, Violin, Drum, Flute, etc.)
- Video preview per course
- Course metadata: duration, class size, rating

### 📬 Notification System
- Booking confirmation email (HTML template)
- Status update email + SMS (Twilio)
- Celery retry logic (max 3 retries, 60s delay)
## 🗄 Database Schema (Supabase / PostgreSQL)

| Table | Key Columns | Description |
|---|---|---|
| `users` | id, username, email, password_hash, role, membership_tier, order_count, total_spent | User accounts & membership |
| `products` | id, name, cat, brand, price, orig, image_url, rating, reviews, specs (JSONB) | Product catalog |
| `orders` | id, order_code, user_id, status, total, subtotal, discount, pay_method, coupon_code | Customer orders |
| `order_items` | order_id, product_id, quantity, price_at_purchase, line_total | Order line items (price snapshot) |
| `coupons` | code, type, value, min_order, max_uses, used_count, expires_at | Discount codes |
| `cart_items` | user_id, product_id, quantity | Persistent cart (logged-in users) |
| `password_resets` | user_id, token_hash, expires_at, used | Secure reset tokens |
| `repair_orders` | code, customer_name, instrument_type, status, estimated_cost, technician_name, eta | Repair bookings |
| `order_logs` | repair_order_id, status, note, updated_by, created_at | Repair workflow history |
| `services` | name, instrument_type, base_price, duration_days, tier | Service catalog |
| `spare_parts` | sku, name, category, unit_price, stock_qty, min_stock | Parts inventory |

> **Security note:** Product prices are always fetched server-side on order creation. Client-submitted prices are ignored.
## 📡 API Endpoints

### Auth `/auth`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/me` | Get current user profile |
| PUT | `/auth/me` | Update profile |
| POST | `/auth/forgot-password` | Send reset email |
| POST | `/auth/reset-password` | Reset with token |

### Products `/products`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/products/` | List all (filter by cat, brand, price, search) |
| GET | `/products/{id}` | Product detail |
| POST | `/products/bulk` | Admin: bulk insert |
| PUT | `/products/{id}` | Admin: update |
| DELETE | `/products/{id}` | Admin: delete |

### Orders `/orders`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/orders/` | Create order (auth required) |
| GET | `/orders/my` | My order history |
| GET | `/orders/{code}` | Order detail |
| GET | `/orders/coupons/{code}` | Validate coupon |
| GET | `/orders/admin/all` | Admin: all orders |
| PUT | `/orders/{code}/status` | Admin: update status |

### Repairs `/repairs`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/repairs/bookings/` | Create repair booking |
| GET | `/repairs/track/{code}` | Track repair status |
| GET | `/repairs/services/` | Service catalog |
| GET | `/repairs/orders/` | Admin: all repairs |
| PATCH | `/repairs/orders/{id}/status` | Admin: update status |
## ⚙️ DevOps & Infrastructure

### 🐳 Docker Containerization
- Multi-stage `Dockerfile` using `python:3.11-slim` base image
- `.dockerignore` to exclude `__pycache__`, `.venv`, `.env`
- Image size optimized: **1.2GB → 705MB** (41% reduction)
- Environment variables injected at runtime (no secrets baked in)

### 🔄 CI/CD Pipeline — GitHub Actions
- Automation: Fully automated Build & Push workflow triggered on git push to master.

- Environment: Executed on ubuntu-latest for consistent and reliable builds.

- Security: Uses GitHub Repository Secrets for secure Docker Hub authentication.

- Workflow: Checkout Code ➔ Docker Login ➔ Build ➔ Push to Registry.

- Versioning: Automated tagging for both v2 and latest versions on Docker Hub.
## 📁 Project Structure
```
strumify/
├── main.py                  # FastAPI app entry point
├── vercel.json              # Vercel deployment config
├── requirements.txt
├── .env                     # Secrets (gitignored)
│
├── app/
│   ├── core/
│   │   ├── security.py      # JWT, bcrypt, auth dependency
│   │   └── supabase_client.py
│   ├── routers/
│   │   ├── rout_auth.py     # Register, Login, Reset Password
│   │   ├── rout_product.py  # Product CRUD
│   │   ├── rout_order.py    # Order flow + admin
│   │   ├── rout_repair.py   # Repair booking workflow
│   │   └── rout_view.py     # Page rendering (Jinja2)
│   ├── models/
│   │   ├── mod_user.py
│   │   ├── mod_product.py
│   │   ├── mod_order.py
│   │   └── mod_repair.py
│   └── schemas/
│       ├── sch_user.py
│       ├── sch_product.py
│       └── sch_order.py
│
├── static/
│   ├── css/                 # Page-specific stylesheets
│   ├── js/                  # Frontend logic
│   └── icons/               # Images, videos
│
├── templates/               # Jinja2 HTML templates
│   ├── base.html
│   ├── home.html
│   ├── order.html
│   ├── cart.html
│   ├── profile.html
│   ├── admin.html
│   └── repair.html
│
├── tasks/
│   └── notifications.py     # Celery async email/SMS
│
└── .github/
    └── workflows/
        └── main.yml         # GitHub Actions CI/CD
```
## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Supabase account
- Redis (for Celery)

### Local Setup
```bash
# 1. Clone repo
git clone https://github.com/Otis308/strumify.git
cd strumify

# 2. Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET, MAIL_*

# 5. Run development server
uvicorn main:app --reload --port 8000

# 6. (Optional) Start Celery worker
celery -A tasks.notifications worker --loglevel=info
```
## 📖 Key Engineering Decisions

| Decision | Why |
|---|---|
| FastAPI over Django | Async-first, auto OpenAPI docs, faster for API-heavy workload |
| Supabase over raw PostgreSQL | Managed DB + built-in Auth + Storage + real-time, reduces ops overhead |
| JWT over session cookies | Stateless, works across Vercel serverless instances |
| Celery for notifications | Prevents blocking HTTP response on slow SMTP/SMS calls |
| Price recalculation server-side | Prevent price manipulation from modified frontend requests |
| Cart dual-storage (localStorage + DB) | UX for guests + data persistence for logged-in users |