/// <reference types="vite/client" />

// (ออปชัน) ประกาศ key ที่ใช้ เพื่อให้ TS รู้ค่าประเภท string
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}