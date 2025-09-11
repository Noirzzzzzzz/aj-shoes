import secrets
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .permissions import IsSuperadmin
from .serializers import UserSerializer

User = get_user_model()

class UserAdminViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer

    def get_permissions(self):
        # Admin-only for all actions here
        return [permissions.IsAuthenticated(), IsSuperadmin()]

    def destroy(self, request, *args, **kwargs):
        # soft ban via is_active=False instead of delete
        user = self.get_object()
        user.is_active = False
        user.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        temp = secrets.token_urlsafe(10)
        user.set_password(temp)
        user.save()
        return Response({"temp_password": temp})

    @action(detail=True, methods=["post"])
    def set_role(self, request, pk=None):
        user = self.get_object()
        role = request.data.get("role")
        if role not in ("superadmin","subadmin","customer"):
            return Response({"detail":"invalid role"}, status=400)
        user.role = role
        user.save()
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=["post"])
    def set_active(self, request, pk=None):
        user = self.get_object()
        active = bool(request.data.get("is_active", True))
        user.is_active = active
        user.save()
        return Response(UserSerializer(user).data)
