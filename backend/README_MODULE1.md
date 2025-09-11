# AJ Shoes – Module 1 (Backend Core)

This module ships a **runnable Django + DRF + Channels** backend for AJ Shoes.

## What’s included
- Python **3.13.x** compatible Django project
- JWT auth with **role-based** permissions (Superadmin / Sub-admin / Customer)
- Catalog: Brands, Categories, Products, Variants, Images (+ sale % logic)
- Coupons (percent / free shipping with thresholds, time windows, limited uses)
- Cart & Orders with simulated tracking (Pending → Shipped → Delivered)
- Wishlist, Reviews, Addresses
- Search & filters (brand, popularity, price, discount ordering)
- Realtime Chat (WebSocket) between customer and admin (QR code link supported)
- Redis cache example (home rows, product queries)
- Seed command to load sample data
- OpenAPI schema via drf-spectacular

> Next modules will add the full React frontend, Admin UI with drag-n-drop images,
> analytics dashboard, exports, tests expansion, and production hardening.

## Windows Setup (PowerShell)
```powershell
# 1) Create & activate venv
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2) Install requirements
pip install -r requirements.txt

# 3) Copy env template
copy .env.example .env

# 4) Ensure Postgres 17 is running and Redis is running (free, local)
#    Update .env DB_*, REDIS_URL if needed.

# 5) Run migrations
python manage.py migrate

# 6) Create superuser
python manage.py createsuperuser

# 7) (Optional) seed sample data
python manage.py seed_sample

# 8) Start ASGI server (for websockets support)
python manage.py runserver 0.0.0.0:8000
```

## API highlights
- OpenAPI: `GET /api/schema/` and Swagger UI at `/api/docs/`
- Auth (JWT): `POST /api/auth/token/` (username, password), `POST /api/auth/refresh/`
- Products: `/api/catalog/products/?brand=...&ordering=price` etc.
- Cart: `/api/orders/cart/` (GET/POST/PATCH/DELETE), apply coupon: `POST /api/orders/cart/apply-coupon/`
- Chat: WebSocket at `ws://localhost:8000/ws/chat/<thread_id>/?token=<JWT>`
- Tracking (simulated): part of `Order` (status flow Pending → Shipped → Delivered)

## Notes
- Default admin roles:
  - **SUPERADMIN**: all privileges (pricing, coupons, user mgmt)
  - **SUBADMIN**: chat only
  - **CUSTOMER**: standard shopping
- Image fields accept either **URL** or uploaded file path. A full image proxy / downloader
  will be added in later modules.
- Internationalization: backend exposes product `name_en/name_th` and `description_en/description_th`.
  The **frontend** will pick per-user language.
