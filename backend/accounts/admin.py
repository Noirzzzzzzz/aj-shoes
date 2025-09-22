from django.contrib import admin
from django.contrib.auth import get_user_model
from .models import AdminNotification, SecurityQuestion

User = get_user_model()

@admin.register(SecurityQuestion)
class SecurityQuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "question", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("question",)
    ordering = ("id",)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    # เพิ่ม first_name, last_name และ security_question
    list_display = ("id", "username", "email", "first_name", "last_name", "role", "security_question")
    list_filter = ("role",)
    search_fields = ("username", "email", "first_name", "last_name")


@admin.register(AdminNotification)
class AdminNotificationAdmin(admin.ModelAdmin):
    list_display = ("created_at", "level", "message_short", "user")
    list_filter = ("level", "created_at")
    search_fields = ("message", "user__username", "user__email")

    def message_short(self, obj):
        return (obj.message[:80] + "…") if len(obj.message) > 80 else obj.message
    message_short.short_description = "Message"
