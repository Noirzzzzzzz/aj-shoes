from rest_framework import serializers
from .models import ChatThread, ChatMessage

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ["id","sender","text","qr_code_url","created_at"]

class ChatThreadSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)
    class Meta:
        model = ChatThread
        fields = ["id","customer","created_at","messages"]
        read_only_fields = ["customer"]
