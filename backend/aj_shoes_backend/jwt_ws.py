# aj_shoes_backend/jwt_ws.py
import re
from urllib.parse import parse_qs
from django.contrib.auth.models import AnonymousUser
from channels.db import database_sync_to_async
from rest_framework_simplejwt.authentication import JWTAuthentication

BEARER_RE = re.compile(r"^Bearer\s+(?P<token>[^,\s]+)$", re.I)

class JWTAuthMiddleware:
    """
    ASGI middleware สำหรับ Django Channels:
      - อ่าน JWT จาก Sec-WebSocket-Protocol: "Bearer, <token>" หรือ "Bearer <token>"
      - หรือจาก query string ?token=<JWT>
      - เซ็ต scope['user'] ให้ถูกต้อง
    """
    def __init__(self, inner):
        self.inner = inner
        self.jwt_auth = JWTAuthentication()

    async def __call__(self, scope, receive, send):
        user = AnonymousUser()
        token = self._extract_token(scope)
        if token:
            try:
                validated = self.jwt_auth.get_validated_token(token)
                user = await database_sync_to_async(self.jwt_auth.get_user)(validated)
            except Exception:
                user = AnonymousUser()

        scope["user"] = user
        return await self.inner(scope, receive, send)

    def _extract_token(self, scope):
        # 1) from Sec-WebSocket-Protocol
        headers = dict(scope.get("headers") or [])
        swsp = headers.get(b"sec-websocket-protocol", b"").decode()
        for part in [p.strip() for p in swsp.split(",") if p.strip()]:
            m = BEARER_RE.match(part)
            if m:
                return m.group("token")
            if part.lower().startswith("bearer "):
                return part.split(None, 1)[1].strip()

        # 2) from query string ?token=
        qs = parse_qs((scope.get("query_string") or b"").decode())
        if "token" in qs and qs["token"]:
            return qs["token"][0]
        return None

def JWTAuthMiddlewareStack(inner):
    # ถ้าอยากพ่วง session/auth อื่น ๆ ก็ครอบเพิ่มได้ภายหลัง
    return JWTAuthMiddleware(inner)
