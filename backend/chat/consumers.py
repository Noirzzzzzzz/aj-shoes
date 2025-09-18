# chat/consumers.py  (replace the whole file or mergeส่วน receive/connect)
import json, time
from collections import deque
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.utils.timezone import now
from .models import ChatRoom, ChatMessage
import base64
from django.core.files.base import ContentFile

User = get_user_model()

MAX_MSG_LEN = 2000
RATE_LIMIT_COUNT = 5
RATE_LIMIT_WINDOW = 1.0  # second
DEDUP_WINDOW = 2.0       # second (กันกดซ้ำเดิมๆ)

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'
        self.user = self.scope.get("user")

        # auth check
        if not self.user or not self.user.is_authenticated:
            await self._error_close(4001, "unauthenticated")
            return

        room = await self.get_room()
        if not room:
            await self._error_close(4004, "room_not_found")
            return

        if not await self.can_access_room(room):
            await self._error_close(4003, "forbidden")
            return

        # join group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        self._recent_times = deque(maxlen=RATE_LIMIT_COUNT)
        self._last_text = None
        self._last_text_ts = 0.0
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            # rate limit
            now_ts = time.time()
            self._recent_times.append(now_ts)
            if len(self._recent_times) == RATE_LIMIT_COUNT and \
               now_ts - self._recent_times[0] < RATE_LIMIT_WINDOW:
                await self._send_error("rate_limited")
                return

            data = json.loads(text_data or "{}")
            message = (data.get('message') or "").strip()
            image_b64 = data.get('image')

            if not message:
                await self._send_error("empty_message")
                return
            if len(message) > MAX_MSG_LEN:
                await self._send_error("message_too_long")
                return
            if message == self._last_text and (now_ts - self._last_text_ts) < DEDUP_WINDOW:
                await self._send_error("duplicate_message")
                return

            room = await self.get_room()
            if not room:
                await self._error_close(4004, "room_not_found")
                return

            chat_message = await self.create_message(room, message, image_b64)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': {
                        'id': chat_message.id,
                        'message': chat_message.message,
                        'image': chat_message.image.url if chat_message.image else None,
                        'sender': chat_message.sender.id,
                        'sender_name': chat_message.sender.username,
                        'sender_role': chat_message.sender.role,
                        'is_admin': chat_message.sender.role in ['superadmin', 'subadmin'],
                        'timestamp': chat_message.timestamp.isoformat(),
                    }
                }
            )
            self._last_text, self._last_text_ts = message, now_ts

        except Exception as e:
            await self._send_error("server_error")
            # (เลือกจะ close ด้วยก็ได้) await self.close(code=1011)

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({'message': event['message']}))

    @database_sync_to_async
    def get_room(self):
        try:
            return ChatRoom.objects.get(id=self.room_id)
        except ChatRoom.DoesNotExist:
            return None

    @database_sync_to_async
    def can_access_room(self, room):
        if self.user.role in ['superadmin', 'subadmin']:
            return True
        return room.customer_id == self.user.id

    @database_sync_to_async
    def create_message(self, room, message_text, image_b64=None):
        img_file = None
        if image_b64:
            try:
                fmt, imgstr = image_b64.split(';base64,')
                ext = fmt.split('/')[-1]
                img_file = ContentFile(base64.b64decode(imgstr), name=f"chat_{int(time.time())}.{ext}")
            except Exception:
                pass
        msg = ChatMessage.objects.create(room=room, sender=self.user, message=message_text, image=img_file)
        room.save(update_fields=["updated_at"])
        return msg
    
    async def _send_error(self, code):
        await self.send(text_data=json.dumps({"type": "error", "code": code}))

    async def _error_close(self, close_code, code_text):
        # ส่ง error ก่อนปิด connection
        try:
            await self.send(text_data=json.dumps({"type": "error", "code": code_text}))
        except Exception:
            pass
        await self.close(code=close_code)
