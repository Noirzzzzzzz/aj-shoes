# AJ Shoes – Module 3 (Backend Admin API)

**Purpose:** เพิ่ม API สำหรับงานหลังบ้าน (Role-based) ให้ใช้กับ Admin UI:
- จัดการสินค้า/รูป/เรียงลำดับ/ตั้ง Cover/เพิ่มรูปด้วย URL
- จัดการ Variants (สี/ไซส์/สต็อก)
- ตั้ง `sale_percent` (เฉพาะ Superadmin)
- จัดการคูปองขั้นสูง + action "generate_rounds" สำหรับคูปองส่งฟรีตามรอบเวลา
- จัดการผู้ใช้ (list/search/เปลี่ยน role/ban-unban/reset password) — เฉพาะ Superadmin

## ติดตั้ง (นำไฟล์ไปวางทับโครงการ Module 1)
1) คัดลอกไฟล์ใน ZIP นี้ไปยังรากโครงการ backend เดิม (มี `aj_shoes_backend/`, `accounts/`, `catalog/`, `coupons/` ฯลฯ)
2) ตรวจสอบไฟล์ `aj_shoes_backend/urls.py` ว่ามีบรรทัด:
```python
path("api/admin/", include("aj_shoes_backend.urls_admin")),
```
ถ้าใช้ไฟล์ใน ZIP นี้จะเพิ่มให้ให้อัตโนมัติแล้ว

3) Migrate ไม่จำเป็น (ไม่มี model ใหม่) แล้วรันเซิร์ฟเวอร์ได้เลย:
```powershell
python manage.py runserver 0.0.0.0:8000
```

## Routes (ใหม่)
- `/api/admin/catalog/products/` (CRUD)
- `/api/admin/catalog/images/` (CRUD + actions: `set_cover`, `reorder`, `add_by_url`)
- `/api/admin/catalog/variants/` (CRUD)
- `/api/admin/coupons/` (CRUD + `POST /api/admin/coupons/generate_rounds/`)
- `/api/admin/users/` (list/search/patch role/is_active + `POST /{id}/reset_password/`)

> Permissions:
> - **Superadmin**: เข้าถึงทั้งหมด รวมตั้ง `sale_percent`, จัดการผู้ใช้, คูปอง
> - **Sub-admin**: (เผื่ออนาคต) อาจให้ดูรายการสินค้า/สต็อก/แชท — ไฟล์นี้จำกัดให้ **เฉพาะ Superadmin** สำหรับ write
