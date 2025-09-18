from django.contrib import admin
from .models import ChatRoom, ChatMessage

@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'created_at', 'updated_at')
    list_filter = ('created_at', 'updated_at')
    search_fields = ('customer__username', 'customer__email')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'room', 'sender', 'message_short', 'timestamp')
    list_filter = ('timestamp', 'sender__role')
    search_fields = ('message', 'sender__username')
    readonly_fields = ('timestamp',)
    
    def message_short(self, obj):
        return obj.message[:50] + "..." if len(obj.message) > 50 else obj.message
    message_short.short_description = "Message"