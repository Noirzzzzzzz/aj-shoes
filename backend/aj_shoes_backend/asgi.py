import os
import django
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "aj_shoes_backend.settings")
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from aj_shoes_backend.jwt_ws import JWTAuthMiddlewareStack

# ✅ รวม websocket ของทั้ง chat และ notifications
from chat.routing import websocket_urlpatterns as chat_ws
from notifications.routing import websocket_urlpatterns as notif_ws

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": JWTAuthMiddlewareStack(
        URLRouter([
            *chat_ws,
            *notif_ws,          # ← สำคัญ: เพิ่มอันนี้
        ])
    ),
})
