import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.conf import settings
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aj_shoes_backend.settings')
django.setup()

from chat.routing import websocket_urlpatterns as chat_ws

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(chat_ws)
    ),
})
