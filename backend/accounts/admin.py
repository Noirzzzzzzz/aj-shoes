from django.contrib import admin
from django.contrib.auth import get_user_model
from .models import AdminNotification

User = get_user_model()

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "email", "role")
    list_filter = ("role",)
    search_fields = ("username", "email")

@admin.register(AdminNotification)
class AdminNotificationAdmin(admin.ModelAdmin):
    list_display = ("created_at", "level", "message_short", "user")
    list_filter = ("level", "created_at")
    search_fields = ("message", "user__username", "user__email")

    def message_short(self, obj):
        return (obj.message[:80] + "…") if len(obj.message) > 80 else obj.message
    message_short.short_description = "Message"