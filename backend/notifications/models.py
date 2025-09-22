# notifications/models.py
from django.conf import settings
from django.db import models

class Notification(models.Model):
    class Channel(models.TextChoices):
        IN_APP = "in_app", "In App"
        WEB_PUSH = "web_push", "Web Push"
        EMAIL = "email", "Email"

    class Kind(models.TextChoices):
        ORDER = "order", "Order"
        CHAT = "chat", "Chat"
        COUPON = "coupon", "Coupon"
        SYSTEM = "system", "System"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.SYSTEM)
    title = models.CharField(max_length=180)
    message = models.TextField(blank=True)
    data = models.JSONField(default=dict, blank=True)  # ลิงก์/ไอดี เพื่อให้ frontend เปิดหน้าที่เกี่ยวข้อง
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

class NotificationPreference(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_pref")
    in_app_enabled = models.BooleanField(default=True)
    web_push_enabled = models.BooleanField(default=False)
    email_digest_enabled = models.BooleanField(default=False)

    order_enabled = models.BooleanField(default=True)
    chat_enabled = models.BooleanField(default=True)
    coupon_enabled = models.BooleanField(default=True)
    system_enabled = models.BooleanField(default=True)

class WebPushSubscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions")
    endpoint = models.URLField(unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
