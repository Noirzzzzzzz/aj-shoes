from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from accounts.permissions import IsSuperadmin
from .models import Coupon
from .serializers import CouponSerializer

class CouponAdminViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.all().order_by("-created_at")
    serializer_class = CouponSerializer

    def get_permissions(self):
        if self.request.method in ["GET", "HEAD", "OPTIONS"]:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsSuperadmin()]

    @action(detail=False, methods=["post"])
    def generate_rounds(self, request):
        # สร้างคูปองส่งฟรีตามรอบเวลา 00:00, 06:00, 12:00, 18:00 ของวันนี้ (โซนเวลาเซิร์ฟเวอร์)
        now = timezone.now().astimezone(timezone.get_current_timezone())
        base = now.replace(hour=0, minute=0, second=0, microsecond=0)
        hours = [0, 6, 12, 18]
        created = []
        for h in hours:
            start = base + timedelta(hours=h)
            end = start + timedelta(hours=5, minutes=59)  # หน้าต่าง 6 ชม.
            code = f"FREESHIP-{start.strftime('%H')}"
            c, _ = Coupon.objects.get_or_create(
                code=code,
                defaults={
                    "discount_type": "free_shipping",
                    "percent_off": 0,
                    "min_spend": 0,
                    "max_uses": 100,
                    "valid_from": start,
                    "valid_to": end
                }
            )
            created.append(c.id)
        return Response({"created": created})
