# AJ Shoes – Module 2 (Frontend React)

**Stack:** React 18 + Vite + TypeScript + TailwindCSS + i18next + Axios + react-router-dom  
**Theme:** Dark mode (default) with toggle, **EN/TH** language toggle  
**Backend:** Points to Module 1 (Django) via `VITE_API_BASE` (default `http://localhost:8000`)

## Windows Setup
```powershell
# 1) Install Node.js LTS (free). Then:
npm install

# 2) Copy env
copy .env.example .env
# (edit VITE_API_BASE if backend not on localhost:8000)

# 3) Start dev server
npm run dev
# open http://localhost:5173
```

## Features in this module
- Netflix-style **Home**: 3 rows (Recommended/Trending/Personalized) from `/api/catalog/products/home_rows/`
- **Search & Filters**: brand + ordering (popularity/price/discount) + search text
- **Product Modal**: images, select **Color / EU/CM size** toggle, quantity, price with old price strike-through & percent off, **Add to Cart gating** (must be logged in + select options + in-stock)
- **Auth**: Register/Login (JWT), auto refresh token, profile
- **Cart**: list/edit qty/remove/apply coupon/checkout (address must exist)
- **Addresses**: create & list
- **Wishlist**: basic UI (backend needs id filter; placeholder implemented)
- **Chat**: realtime via WebSocket, supports QR link messages
- **i18n**: EN/TH switch
- **Theme**: Dark default; toggle persists
- **Responsive & A11y basics**: alt text, keyboard-friendly, skeleton loaders

## Notes
- Ensure Module 1 backend is running with Redis; create a user & login to enable cart/chat.
- For production build, run `npm run build` then serve `dist/` with a static server or behind a reverse proxy.
- Admin UI (drag sort images, image URL upload, variants CRUD with guardrails) will arrive in **Module 3**.
