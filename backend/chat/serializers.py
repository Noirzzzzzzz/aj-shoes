from rest_framework import serializers
from .models import ChatRoom, ChatMessage

class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    sender_role = serializers.CharField(source='sender.role', read_only=True)
    is_admin = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatMessage
        fields = ['id', 'message', 'image', 'timestamp', 'sender', 'sender_name', 'sender_role', 'is_admin']
        read_only_fields = ['sender', 'timestamp']
    
    def get_is_admin(self, obj):
        return obj.sender.role in ['superadmin', 'subadmin']

class ChatRoomSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.username', read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatRoom
        fields = ['id', 'customer', 'customer_name', 'customer_email', 'created_at', 'updated_at', 'last_message', 'unread_count']
    
    def get_last_message(self, obj):
        last_msg = obj.messages.last()
        if last_msg:
            return {
                'message': last_msg.message,
                'timestamp': last_msg.timestamp,
                'sender_name': last_msg.sender.username,
                'is_admin': last_msg.sender.role in ['superadmin', 'subadmin']
            }
        return None
    
    def get_unread_count(self, obj):
        # สำหรับอนาคต - นับข้อความที่ยังไม่ได้อ่าน
        return 0