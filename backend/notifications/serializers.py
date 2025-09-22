# notifications/serializers.py
from rest_framework import serializers
from .models import Notification, NotificationPreference, WebPushSubscription

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "kind", "title", "message", "data", "is_read", "created_at"]

class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ["in_app_enabled","web_push_enabled","email_digest_enabled",
                  "order_enabled","chat_enabled","coupon_enabled","system_enabled"]

class WebPushSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebPushSubscription
        fields = ["endpoint","p256dh","auth"]
