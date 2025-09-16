import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  withCredentials: false,
});

let access = localStorage.getItem("access") || "";
let refresh = localStorage.getItem("refresh") || "";

export function setTokens(a: string, r: string) {
  access = a; refresh = r;
  localStorage.setItem("access", a);
  localStorage.setItem("refresh", r);
}

export function clearTokens() {
  access = ""; refresh = "";
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
}

api.interceptors.request.use(config => {
  if (access) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

let refreshing = false;
api.interceptors.response.use(
  r => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && refresh) {
      original._retry = true;
      if (!refreshing) {
        refreshing = true;
        try {
          const resp = await axios.post(`${api.defaults.baseURL}/api/auth/refresh/`, { refresh });
          access = resp.data.access;
          localStorage.setItem("access", access);
        } catch (e) {
          clearTokens();
        } finally {
          refreshing = false;
        }
      }
      return api(original);
    }
    throw error;
  }
);

export default api;
