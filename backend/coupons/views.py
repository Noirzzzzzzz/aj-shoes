from rest_framework import viewsets, permissions
from .models import Coupon
from .serializers import CouponSerializer

class CouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.all().order_by("-created_at")
    serializer_class = CouponSerializer

    def get_permissions(self):
        if self.request.method in ["POST","PUT","PATCH","DELETE"]:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]
