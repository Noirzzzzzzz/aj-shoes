# AJ Shoes – Module 5 (Backend Performance & Observability)

ฟีเจอร์:
- ✅ **Image Optimization/Thumbnail Proxy**: `/img/opt/?url=<image_url>&w=320&h=320&fit=cover&q=85`
  - ดึงรูปจาก URL ต้นทาง → resize ด้วย Pillow → cache ลงดิสก์ → ตอบกลับไฟล์ภาพ
- ✅ **API Simple Cache (Redis-backed)**: Middleware cache GET responses สำหรับ:
  - `/api/catalog/products/`
  - `/api/catalog/products/home_rows/`
  - TTL ตั้งค่าผ่าน `API_CACHE_SECONDS` (ค่าเริ่ม 60s)
- ✅ **Frontend Error Intake**: `POST /api/logs/frontend/` รับ error จาก frontend แล้วเขียน log ไฟล์
- ✅ **Django Logging Config**: เขียน log ไฟล์ `logs/app.log` + console
- ✅ **Unit tests ตัวอย่าง**

## ติดตั้ง
1) ติดตั้ง dependency เพิ่ม:
```powershell
pip install pillow requests
```
2) คัดลอกไฟล์ใน ZIP นี้ไปวางทับโครงการ backend ของคุณ
3) เพิ่ม MIDDLEWARE และ URL:
   - ใน `aj_shoes_backend/settings.py` เพิ่ม:
```python
MIDDLEWARE.insert(0, "aj_shoes_backend.middleware.cache_api.APISimpleCacheMiddleware")
LOG_DIR = BASE_DIR / "logs"; LOG_DIR.mkdir(exist_ok=True)
from aj_shoes_backend.logging_setup import LOGGING  # ใช้ LOGGING ที่ให้มา
CACHES.setdefault("default", {"BACKEND":"django_redis.cache.RedisCache","LOCATION": os.getenv("REDIS_URL","redis://127.0.0.1:6379/1"),"OPTIONS":{"CLIENT_CLASS":"django_redis.client.DefaultClient"}})
API_CACHE_SECONDS = int(os.getenv("API_CACHE_SECONDS","60"))
```
   - ใน `aj_shoes_backend/urls.py` เพิ่มบรรทัด:
```python
from aj_shoes_backend.observability_views import FrontendLogView
from aj_shoes_backend.image_opt import optimize_image
urlpatterns += [
    path("api/logs/frontend/", FrontendLogView.as_view()),
    path("img/opt/", optimize_image),
]
```
4) สร้างโฟลเดอร์สำหรับ cache รูป:
```powershell
mkdir media\cache
```
5) รันทดสอบ (ทางเลือก): `pytest` หรือ `python manage.py test`

> หมายเหตุ: Proxy นี้เพื่อ dev/demo ในโปรดักชันควรทำผ่าน CDN/Edge และวางกฎ CORS/allowlist โดเมนรูป
