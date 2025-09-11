import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from urllib.parse import parse_qs
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from asgiref.sync import sync_to_async
from .models import ChatThread, ChatMessage

User = get_user_model()

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.thread_id = self.scope["url_route"]["kwargs"]["thread_id"]
        # simple JWT auth via ?token=
        token = parse_qs(self.scope["query_string"].decode()).get("token", [None])[0]
        self.user = None
        if token:
            try:
                at = AccessToken(token)
                user_id = at["user_id"]
                self.user = await sync_to_async(User.objects.get)(id=user_id)
            except Exception:
                pass
        if self.user is None:
            await self.close()
            return
        self.group_name = f"chat_{self.thread_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        text = content.get("text", "")
        qr = content.get("qr_code_url", "")
        thread = await sync_to_async(ChatThread.objects.get)(id=self.thread_id)
        msg = await sync_to_async(ChatMessage.objects.create)(thread=thread, sender=self.user, text=text, qr_code_url=qr)
        payload = {
            "type": "chat.message",
            "data": {"id": msg.id, "sender": self.user.id, "text": text, "qr_code_url": qr}
        }
        await self.channel_layer.group_send(self.group_name, payload)

    async def chat_message(self, event):
        await self.send_json(event["data"])
