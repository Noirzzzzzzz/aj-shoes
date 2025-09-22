# notifications/utils.py
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Notification

def create_and_push(user, kind, title, message="", data=None):
    n = Notification.objects.create(
        user=user, kind=kind, title=title, message=message, data=data or {}
    )
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"user_{user.id}_notifications",
        {"type": "notify", "payload": {
            "id": n.id, "kind": n.kind, "title": n.title,
            "message": n.message, "data": n.data, "created_at": n.created_at.isoformat(),
        }}
    )
    return n
