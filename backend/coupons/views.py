from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone
from django.db import models  # Q, F
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Coupon, UserCoupon
from .serializers import (
    CouponSerializer, CouponCenterSerializer, UserCouponSerializer
)


class CouponViewSet(viewsets.ModelViewSet):
    """
    Endpoints:
      - GET  /api/coupons/center/          : คูปองที่ยัง Active สำหรับหน้า Coupon Center
      - POST /api/coupons/{id}/claim/      : เก็บคูปอง (1 คน/ใบ ครั้งเดียว)
      - GET  /api/coupons/mine/            : คูปองของฉันที่ยัง Active (ใช้ใน Cart)
      - POST /api/coupons/price-preview/   : คำนวณยอดแบบ Real-time จากรหัสคูปอง (ไม่แตะตะกร้า)
    """
    queryset = Coupon.objects.all().order_by("-created_at")
    serializer_class = CouponSerializer

    def get_permissions(self):
        # POST/PUT/PATCH/DELETE ต้องล็อกอิน (แอดมินจริงให้ใช้ admin_api)
        if self.request.method in ["POST", "PUT", "PATCH", "DELETE"]:
            return [permissions.IsAuthenticated()]
        # GET เปิด public เพื่อให้ Coupon Center เห็นได้
        return [permissions.AllowAny()]

    # GET /api/coupons/center/  → แสดงเฉพาะคูปองที่ Active
    @action(detail=False, methods=["get"])
    def center(self, request):
        qs = Coupon.active_qs().order_by("-discount_type", "-percent_off", "-valid_to")
        data = CouponCenterSerializer(qs, many=True).data
        # ถ้าล็อกอินแล้วให้ติดธง claimed เพื่อเปลี่ยนปุ่มเป็น “เก็บแล้ว”
        if request.user and request.user.is_authenticated:
            claimed_codes = set(
                UserCoupon.objects.filter(user=request.user, coupon__in=qs)
                .values_list("coupon__code", flat=True)
            )
            for row in data:
                row["claimed"] = row["code"] in claimed_codes
        return Response(data)

    # POST /api/coupons/{id}/claim/  → เก็บคูปอง (กันซ้ำด้วย unique_together)
    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def claim(self, request, pk=None):
        coupon = self.get_object()
        if not coupon.is_active():
            return Response({"detail": "Coupon expired or unavailable."}, status=status.HTTP_400_BAD_REQUEST)
        obj, created = UserCoupon.objects.get_or_create(user=request.user, coupon=coupon)
        if not created:
            return Response({"detail": "You already claimed this coupon."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Coupon claimed."})

    # GET /api/coupons/mine/ → คูปองของฉันที่ยัง Active (ใช้ใน Cart)
    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def mine(self, request):
        now = timezone.now()
        qs = UserCoupon.objects.filter(
            user=request.user, used=False,
            coupon__valid_from__lte=now
        ).filter(
            models.Q(coupon__valid_to__isnull=True) | models.Q(coupon__valid_to__gte=now)
        ).filter(
            models.Q(coupon__max_uses=0) | models.Q(coupon__uses_count__lt=models.F("coupon__max_uses"))
        ).select_related("coupon")

        data = UserCouponSerializer(qs, many=True).data
        percent = [d for d in data if d["discount_type"] == "percent"]
        percent.sort(key=lambda x: (x.get("percent_off") or 0), reverse=True)
        frees = [d for d in data if d["discount_type"] == "free_shipping"]
        return Response({"percent": percent, "free_shipping": frees})

    # POST /api/coupons/price-preview/ → คำนวณราคาแบบ Real-time จากรหัสคูปองที่ส่งมา
    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def price_preview(self, request):
        """
        body:
          {
            "subtotal": 4200,
            "shipping_fee": 50,
            "coupon_codes": ["SAVE25", "FREESHIP"]
          }
        เลือกใช้ได้สูงสุด: คูปองส่วนลด% ที่มากที่สุด 1 ใบ + คูปองส่งฟรี 1 ใบ
        เงื่อนไข: คูปองต้อง active และผู้ใช้คนนี้ 'เคยเก็บ' แล้ว
        """
        try:
            subtotal = Decimal(str(request.data.get("subtotal", 0)))
            shipping_fee = Decimal(str(request.data.get("shipping_fee", 0)))
        except Exception:
            return Response({"detail": "Invalid subtotal/shipping_fee"}, status=status.HTTP_400_BAD_REQUEST)

        codes = request.data.get("coupon_codes") or []
        codes = list(dict.fromkeys([str(c).strip() for c in codes if c]))  # กันซ้ำ + trim

        if not codes:
            return Response({
                "applied_coupons": [],
                "discount_percent": 0,
                "discount_amount": Decimal("0.00"),
                "free_shipping": False,
                "shipping_fee": shipping_fee,
                "subtotal": subtotal,
                "total": (subtotal + shipping_fee),
            })

        # เลือกเฉพาะคูปองที่ยัง active และผู้ใช้คนนี้เคย claim แล้ว
        coupons = []
        for c in Coupon.objects.filter(code__in=codes):
            if not c.is_active():
                continue
            if not UserCoupon.objects.filter(user=request.user, coupon=c).exists():
                continue
            coupons.append(c)

        best_percent = None
        free_ship = None
        for c in coupons:
            if c.discount_type == "percent":
                if (best_percent is None) or int(c.percent_off or 0) > int(best_percent.percent_off or 0):
                    best_percent = c
            elif c.discount_type == "free_shipping":
                free_ship = c

        applied = []
        discount_amount = Decimal("0.00")
        discount_percent = 0

        if best_percent and subtotal >= Decimal(str(best_percent.min_spend or 0)):
            discount_percent = int(best_percent.percent_off or 0)
            discount_amount = (subtotal * Decimal(discount_percent) / Decimal(100)).quantize(Decimal("1."), rounding=ROUND_HALF_UP)
            applied.append({
                "code": best_percent.code,
                "discount_type": "percent",
                "percent_off": discount_percent
            })

        free_shipping = bool(free_ship)
        if free_shipping:
            applied.append({
                "code": free_ship.code,
                "discount_type": "free_shipping"
            })

        effective_shipping = Decimal("0.00") if free_shipping else shipping_fee
        total = subtotal - discount_amount + effective_shipping
        if total < 0:
            total = Decimal("0.00")

        return Response({
            "applied_coupons": applied,
            "discount_percent": discount_percent,
            "discount_amount": discount_amount,
            "free_shipping": free_shipping,
            "shipping_fee": effective_shipping,
            "subtotal": subtotal,
            "total": total,
        })
