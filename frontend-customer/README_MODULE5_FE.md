# AJ Shoes – Module 5 (Frontend – Performance & Observability)

- ✅ **Error Boundary + Global error capture** → ส่ง log ไปที่ `/api/logs/frontend/`
- ✅ **ใช้รูปแบบ Optimize proxy**: helper `optImg(url, {w,h,fit,q})` คืน URL `/img/opt/?...`
- ✅ **ปรับหน้า ProductCard/Modal ให้เรียกรูปแบบย่อ (thumbnail)**
- ✅ (แนะนำ) เปิด Code-splitting/Lazy import เพิ่มเติมหากต้องการ

## ติดตั้ง
1) คัดลอกไฟล์ใน ZIP นี้ไปทับโปรเจกต์ **Frontend ลูกค้า (Module 2)**
2) แก้ `src/main.tsx` ให้ครอบ `<App />` ด้วย `<ErrorBoundary>` (ไฟล์นี้ให้มาแล้ว)
3) เรียกใช้ `optImg` ในจุดที่แสดงภาพ (ตัวอย่างให้มาแล้วใน ProductCard/Modal)
