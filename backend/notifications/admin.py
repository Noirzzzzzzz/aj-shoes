from django.contrib import admin
from django.utils.html import format_html
from .models import Notification, NotificationPreference, WebPushSubscription

# ----- Actions ที่ใช้บ่อย -----
@admin.action(description="Mark selected notifications as READ")
def mark_as_read(modeladmin, request, queryset):
    queryset.update(is_read=True)

@admin.action(description="Mark selected notifications as UNREAD")
def mark_as_unread(modeladmin, request, queryset):
    queryset.update(is_read=False)

@admin.action(description="Push (send) selected notifications via WS")
def push_again(modeladmin, request, queryset):
    # ยิงซ้ำไปยัง WS group ของ user
    try:
        from .utils import create_and_push
    except Exception:
        create_and_push = None

    count = 0
    if create_and_push:
        for n in queryset:
            create_and_push(
                user=n.user,
                kind=n.kind,
                title=n.title,
                message=n.message or "",
                data=n.data or {},
            )
            count += 1
    modeladmin.message_user(request, f"Pushed {count} notification(s).")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user", "kind", "short_title", "is_read", "created_at",
    )
    list_filter = ("kind", "is_read", "created_at")
    search_fields = ("title", "message", "user__username", "user__email")
    date_hierarchy = "created_at"
    actions = [mark_as_read, mark_as_unread, push_again]
    ordering = ("-created_at",)

    def short_title(self, obj):
        # ตัดให้สั้นใน list page
        t = obj.title or ""
        return (t[:60] + "…") if len(t) > 60 else t
    short_title.short_description = "title"

    readonly_fields = ("created_at",)
    fieldsets = (
        (None, {
            "fields": ("user", "kind", "title", "message", "data", "is_read", "created_at")
        }),
    )


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "in_app_enabled", "web_push_enabled", "email_digest_enabled",
        "order_enabled", "chat_enabled", "coupon_enabled", "system_enabled",
    )
    list_filter = (
        "in_app_enabled", "web_push_enabled", "email_digest_enabled",
        "order_enabled", "chat_enabled", "coupon_enabled", "system_enabled",
    )
    search_fields = ("user__username", "user__email")


@admin.register(WebPushSubscription)
class WebPushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("user", "endpoint_link", "created_at")
    search_fields = ("user__username", "user__email", "endpoint")
    readonly_fields = ("created_at",)

    def endpoint_link(self, obj):
        # คลิกลิงก์ออกไปดู endpoint ได้
        return format_html('<a href="{}" target="_blank" rel="noopener">open</a>', obj.endpoint)
    endpoint_link.short_description = "endpoint"
