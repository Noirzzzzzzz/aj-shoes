import os
import io
import hashlib
import requests
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image, ImageOps
from django.http import HttpResponse, HttpResponseBadRequest
from django.conf import settings

# --- Path & Cache setup (cross-platform) ---
# MEDIA_ROOT อาจเป็น str หรือ pathlib.Path -> แปลงเป็น Path เสมอ
MEDIA_ROOT = Path(getattr(settings, "MEDIA_ROOT", Path(os.getcwd()) / "media"))
CACHE_DIR = MEDIA_ROOT / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Pillow 10+ ย้าย Resampling ไปอยู่ใน Image.Resampling
try:
    RESAMPLE = Image.Resampling.LANCZOS  # Pillow >= 10
except AttributeError:
    RESAMPLE = Image.LANCZOS  # Pillow < 10


def _safe_name(url: str, w: int, h: int, fit: str, q: int) -> Path:
    hsh = hashlib.sha256(f"{url}|{w}|{h}|{fit}|{q}".encode("utf-8")).hexdigest()[:24]
    return CACHE_DIR / f"{hsh}.jpg"


def optimize_image(request):
    url = request.GET.get("url", "").strip()
    if not url or not url.lower().startswith(("http://", "https://")):
        return HttpResponseBadRequest("url required")

    try:
        w = int(request.GET.get("w", "320"))
        h = int(request.GET.get("h", "320"))
        q = int(request.GET.get("q", "85"))
        fit = request.GET.get("fit", "cover")
    except Exception:
        return HttpResponseBadRequest("invalid params")

    out_path = _safe_name(url, w, h, fit, q)

    # serve from cache if exists
    if out_path.exists():
        data = out_path.read_bytes()
        resp = HttpResponse(data, content_type="image/jpeg")
        resp["Cache-Control"] = "public, max-age=86400"
        return resp

    # fetch remote
    r = requests.get(url, timeout=10)
    r.raise_for_status()

    im = Image.open(io.BytesIO(r.content)).convert("RGB")
    if fit == "cover":
        im = ImageOps.fit(im, (w, h), method=RESAMPLE)
    else:
        im.thumbnail((w, h), RESAMPLE)

    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=q, optimize=True)
    data = buf.getvalue()

    out_path.write_bytes(data)

    resp = HttpResponse(data, content_type="image/jpeg")
    resp["Cache-Control"] = "public, max-age=86400"
    return resp
