from django.db import models
from django.conf import settings

User = settings.AUTH_USER_MODEL

class ChatThread(models.Model):
    customer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="chat_threads")
    created_at = models.DateTimeField(auto_now_add=True)

class ChatMessage(models.Model):
    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField(blank=True, default="")
    qr_code_url = models.URLField(blank=True, default="")  # admin can send QR link
    created_at = models.DateTimeField(auto_now_add=True)
