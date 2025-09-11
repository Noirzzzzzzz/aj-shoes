# AJ Shoes – Module 4 (Backend Analytics & Exports)

เพิ่ม REST endpoints สำหรับ Dashboard/Reports + ปุ่ม Export CSV/Excel

## ติดตั้ง
1) คัดลอกไฟล์ทั้งหมดใน ZIP นี้ไปไว้ทับที่รากโปรเจกต์ backend (มี `aj_shoes_backend/`).
2) ติดตั้งไลบรารีเพิ่มสำหรับ Excel:
```powershell
pip install openpyxl>=3.1.5
```
3) รันเซิร์ฟเวอร์
```powershell
python manage.py runserver 0.0.0.0:8000
```

## Routes ใหม่ (ภายใต้ `/api/admin/analytics/`)
- `GET sales_summary/` — kpis + series + breakdowns + top_products  
  พารามิเตอร์: `date_from`, `date_to` (YYYY-MM-DD), `group` = `day|week|month|quarter`,  
  `brands`, `categories`, `coupons` (คั่นด้วยคอมมา, ใช้ id ของ brand/category และ **code** ของ coupon)
- `GET top_products/` — เฉพาะสินค้าขายดี (ใช้พารามิเตอร์เดียวกับ `sales_summary`, มี `limit`)
- `GET export.csv` — ไฟล์ CSV รายการขายเชิงเส้น (order items)
- `GET export.xlsx` — ไฟล์ Excel รายการขายเชิงเส้น
- `GET export_stock.csv` — สต็อกปัจจุบันจาก Variants

> หมายเหตุ: เพื่อความง่าย คิดยอดจากทุกสถานะ order (pending/shipped/delivered). ถ้าต้องคิดเฉพาะ delivered สามารถเพิ่ม filter ได้ง่าย ๆ.
