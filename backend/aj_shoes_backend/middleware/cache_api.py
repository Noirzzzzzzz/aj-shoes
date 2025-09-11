import hashlib, time, os
from django.core.cache import caches
from django.http import HttpResponse

CACHE_PATHS = ("/api/catalog/products/", "/api/catalog/products/home_rows/")

class APISimpleCacheMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.cache = caches["default"]
        self.ttl = int(os.getenv("API_CACHE_SECONDS", "60"))

    def __call__(self, request):
        if request.method != "GET":
            return self.get_response(request)
        path = request.path
        if not any(path.startswith(p) for p in CACHE_PATHS):
            return self.get_response(request)

        key = "api-cache:" + hashlib.sha256((request.get_full_path()).encode("utf-8")).hexdigest()
        cached = self.cache.get(key)
        if cached:
            resp = HttpResponse(cached["body"], status=cached["status"], content_type=cached["ctype"])
            for h, v in cached["headers"].items():
                resp[h] = v
            resp["X-Cache-Hit"] = "1"
            return resp

        resp = self.get_response(request)
        try:
            body = resp.content
            ctype = resp.get("Content-Type", "application/json")
            headers = {"Cache-Control": f"public, max-age={self.ttl}"}
            self.cache.set(key, {"body": body, "status": resp.status_code, "ctype": ctype, "headers": headers}, timeout=self.ttl)
            resp["Cache-Control"] = headers["Cache-Control"]
            resp["X-Cache-Hit"] = "0"
        except Exception:
            pass
        return resp
