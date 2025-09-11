import axios from "axios";
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:8000",
});
let access = localStorage.getItem("access") || "";
let refresh = localStorage.getItem("refresh") || "";
export function setTokens(a:string, r:string){ access=a; refresh=r; localStorage.setItem("access",a); localStorage.setItem("refresh",r); }
export function clearTokens(){ access=""; refresh=""; localStorage.removeItem("access"); localStorage.removeItem("refresh"); }
api.interceptors.request.use(cfg => { if(access){ cfg.headers = cfg.headers||{}; cfg.headers.Authorization = `Bearer ${access}`; } return cfg; });
api.interceptors.response.use(r=>r, async (err)=>{
  const original = err.config;
  if (err.response?.status===401 && !original._retry && refresh){
    original._retry = true;
    try {
      const resp = await axios.post(`${api.defaults.baseURL}/api/auth/refresh/`, { refresh });
      access = resp.data.access; localStorage.setItem("access", access);
      return api(original);
    } catch(e){
      clearTokens();
    }
  }
  throw err;
});
export default api;
