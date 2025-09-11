# AJ Shoes – Module 5 (Admin Frontend – Performance & Observability)

- ✅ Error Boundary + Global error capture → ส่งไป `/api/logs/frontend/`
- ✅ (ทางเลือก) Lazy-load pages
- ใช้กับโปรเจกต์ Admin Frontend (Module 3)

## ติดตั้ง
1) คัดลอกไฟล์นี้ไปทับโปรเจกต์ Admin Frontend
2) main.tsx จะห่อ `<App />` ด้วย `<ErrorBoundary>` และลง global listeners ให้แล้ว
