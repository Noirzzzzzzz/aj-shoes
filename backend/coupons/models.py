# models.py — READY TO REPLACE
from django.db import models
from django.utils import timezone
from django.conf import settings
from django.db.models import Count, F, Q  # ✅ เพิ่ม

class Coupon(models.Model):
    class DiscountType(models.TextChoices):
        PERCENT = "percent", "Percent"
        FREE_SHIPPING = "free_shipping", "Free Shipping"

    code = models.CharField(max_length=32, unique=True)
    discount_type = models.CharField(max_length=20, choices=DiscountType.choices, default=DiscountType.PERCENT)
    percent_off = models.PositiveIntegerField(default=0)  # 5-50
    min_spend = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_uses = models.PositiveIntegerField(default=0)  # 0 = unlimited (ไม่จำกัดจำนวนแจก)
    uses_count = models.PositiveIntegerField(default=0)  # จำนวน "ที่ถูกใช้" ตอนคิดบิล (เก็บไว้ใช้ภายหลัง)
    valid_from = models.DateTimeField(default=timezone.now)
    valid_to = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_active(self):
        """Active เมื่ออยู่ในช่วงเวลา และจำนวน 'ที่ถูกเก็บ' ยังไม่เต็มโควต้า"""
        now = timezone.now()
        if self.valid_to and now > self.valid_to:
            return False
        if self.valid_from and now < self.valid_from:
            return False
        if self.max_uses:
            claimed_count = self.claimed_users.count()  # ใช้ related_name จาก UserCoupon ด้านล่าง
            if claimed_count >= self.max_uses:
                return False
        return True

    @staticmethod
    def active_qs():
        """
        คืน queryset ของคูปองที่ยังแจกได้
        เงื่อนไข: ช่วงเวลา OK และ (max_uses=0 หรือ claimed_count < max_uses)
        """
        now = timezone.now()
        qs = (
            Coupon.objects.filter(valid_from__lte=now)
            .filter(Q(valid_to__isnull=True) | Q(valid_to__gte=now))
            .annotate(claimed_count=Count("claimed_users"))
            .filter(Q(max_uses=0) | Q(claimed_count__lt=F("max_uses")))
        )
        return qs

    def remaining(self):
        """จำนวนสิทธิ์ที่ยังเหลือสำหรับ 'การเก็บ' (แสดงใน Coupon Center)"""
        if not self.max_uses:
            return None  # unlimited
        # ถ้ามี annotation มาแล้วจะไม่ยิง query ซ้ำ
        claimed = getattr(self, "claimed_count", None)
        if claimed is None:
            claimed = self.claimed_users.count()
        return max(0, self.max_uses - claimed)

    def __str__(self):
        return self.code


class UserCoupon(models.Model):
    """ผู้ใช้คนหนึ่ง 'เก็บ' คูปองใบนี้แล้ว (กันเก็บซ้ำ)"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_coupons")
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name="claimed_users")
    claimed_at = models.DateTimeField(auto_now_add=True)
    used = models.BooleanField(default=False)  # เซ็ต True เมื่อใช้ตอน checkout สำเร็จ

    class Meta:
        unique_together = ("user", "coupon")

    def __str__(self):
        return f"{self.user_id} - {self.coupon.code}"
