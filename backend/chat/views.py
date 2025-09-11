from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from .models import ChatThread, ChatMessage
from .serializers import ChatThreadSerializer, ChatMessageSerializer

User = get_user_model()

class ChatThreadViewSet(viewsets.ModelViewSet):
    serializer_class = ChatThreadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or getattr(user, "role", "") in ("superadmin", "subadmin"):
            return ChatThread.objects.all().order_by("-created_at")
        return ChatThread.objects.filter(customer=user).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(customer=self.request.user)

    @action(detail=True, methods=["post"])
    def message(self, request, pk=None):
        thread = get_object_or_404(ChatThread, pk=pk)
        text = request.data.get("text","")
        qr = request.data.get("qr_code_url","")
        msg = ChatMessage.objects.create(thread=thread, sender=request.user, text=text, qr_code_url=qr)
        return Response(ChatMessageSerializer(msg).data, status=201)
