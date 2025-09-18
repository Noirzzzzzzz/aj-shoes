from rest_framework import generics, permissions
from django.contrib.auth import get_user_model
from .serializers import RegisterSerializer, UserSerializer

# LogEntry / ContentType
from django.contrib.admin.models import LogEntry, CHANGE
from django.contrib.contenttypes.models import ContentType

# ✅ ใช้ Address ของแอป orders เพื่อซิงก์ default address
from orders.models import Address

User = get_user_model()

# (optional) AdminNotification
try:
    from .models import AdminNotification
    HAS_NOTIFICATION = True
except Exception:
    HAS_NOTIFICATION = False


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/accounts/me/   -> อ่านโปรไฟล์ของตัวเอง
    PUT  /api/accounts/me/   -> อัปเดตโปรไฟล์ของตัวเอง (partial update)
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def perform_update(self, serializer):
        # เซฟข้อมูลที่แก้ไข
        user = serializer.save()

        # 1) LogEntry บน Django Admin
        LogEntry.objects.log_action(
            user_id=self.request.user.id,
            content_type_id=ContentType.objects.get_for_model(User).pk,
            object_id=str(user.pk),
            object_repr=user.get_username(),
            action_flag=CHANGE,
            change_message="User updated own profile via customer portal.",
        )

        # 2) (ถ้ามี) สร้าง Notification ในแอดมิน
        if HAS_NOTIFICATION:
            AdminNotification.objects.create(
                level="info",
                message="Profile updated by customer.",
                user=self.request.user,
                related_content_type=ContentType.objects.get_for_model(User),
                related_object_id=str(user.pk),
            )

        # 3) ✅ ซิงก์ default_address -> Orders.Address (is_default=True)
        addr_text = serializer.validated_data.get("default_address", None)
        phone_text = serializer.validated_data.get("phone", None) or getattr(user, "phone", "")

        # ใช้ชื่อเต็มจาก first_name + last_name ถ้ามี ไม่งั้น fallback เป็น username
        full_name = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip() or user.get_username()

        if addr_text is not None:
            addr, created = Address.objects.get_or_create(
                user=user,
                is_default=True,
                defaults={
                    "full_name": full_name,
                    "phone": phone_text or "",
                    "address": addr_text or "",
                    "province": "",
                    "postal_code": "",
                },
            )
            if not created:
                addr.full_name = full_name
                if phone_text is not None:
                    addr.phone = phone_text
                addr.address = addr_text or ""
                addr.save()
