# aj_shoes_backend/image_opt.py  (replace entire file)
import os, io, hashlib, socket, ipaddress, requests
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image, ImageOps
from django.http import HttpResponse, HttpResponseBadRequest
from django.conf import settings

MEDIA_ROOT = Path(getattr(settings, "MEDIA_ROOT", Path(os.getcwd()) / "media"))
CACHE_DIR = MEDIA_ROOT / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

try:
    RESAMPLE = Image.Resampling.LANCZOS
except AttributeError:
    RESAMPLE = Image.LANCZOS

ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_CT = {"image/jpeg", "image/png", "image/webp"}
MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024  # 5MB
TIMEOUT = 8

def _safe_name(url: str, w: int, h: int, fit: str, q: int) -> Path:
    hsh = hashlib.sha256(f"{url}|{w}|{h}|{fit}|{q}".encode("utf-8")).hexdigest()[:24]
    return CACHE_DIR / f"{hsh}.jpg"

def _is_private_host(hostname: str) -> bool:
    try:
        ip = ipaddress.ip_address(socket.gethostbyname(hostname))
        return ip.is_private or ip.is_loopback or ip.is_link_local
    except Exception:
        return True  # ถ้า resolve ไม่ได้ -> treat as unsafe

def optimize_image(request):
    url = (request.GET.get("url") or "").strip()
    if not url:
        return HttpResponseBadRequest("url required")

    u = urlparse(url)
    if u.scheme not in ALLOWED_SCHEMES or not u.netloc or _is_private_host(u.hostname):
        return HttpResponseBadRequest("blocked url")

    try:
        w = max(1, int(request.GET.get("w", "320")))
        h = max(1, int(request.GET.get("h", "320")))
        q = max(10, min(95, int(request.GET.get("q", "85"))))
        fit = request.GET.get("fit", "cover")
    except Exception:
        return HttpResponseBadRequest("invalid params")

    out_path = _safe_name(url, w, h, fit, q)
    if out_path.exists():
        data = out_path.read_bytes()
        resp = HttpResponse(data, content_type="image/jpeg")
        resp["Cache-Control"] = "public, max-age=86400"
        return resp

    # stream & cap size
    with requests.get(url, timeout=TIMEOUT, stream=True) as r:
        r.raise_for_status()
        if r.headers.get("Content-Type", "").split(";")[0].lower() not in ALLOWED_CT:
            return HttpResponseBadRequest("invalid content-type")
        buf = io.BytesIO()
        downloaded = 0
        for chunk in r.iter_content(64 * 1024):
            if not chunk:
                break
            downloaded += len(chunk)
            if downloaded > MAX_DOWNLOAD_BYTES:
                return HttpResponseBadRequest("file too large")
            buf.write(chunk)
        data = buf.getvalue()

    im = Image.open(io.BytesIO(data)).convert("RGB")
    if fit == "cover":
        im = ImageOps.fit(im, (w, h), method=RESAMPLE)
    else:
        im.thumbnail((w, h), RESAMPLE)

    out = io.BytesIO()
    im.save(out, format="JPEG", quality=q, optimize=True)
    data = out.getvalue()
    out_path.write_bytes(data)

    resp = HttpResponse(data, content_type="image/jpeg")
    resp["Cache-Control"] = "public, max-age=86400"
    return resp
