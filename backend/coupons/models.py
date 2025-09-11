from django.db import models
from django.utils import timezone

class Coupon(models.Model):
    class DiscountType(models.TextChoices):
        PERCENT = "percent", "Percent"
        FREE_SHIPPING = "free_shipping", "Free Shipping"

    code = models.CharField(max_length=32, unique=True)
    discount_type = models.CharField(max_length=20, choices=DiscountType.choices, default=DiscountType.PERCENT)
    percent_off = models.PositiveIntegerField(default=0)  # 5-50
    min_spend = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_uses = models.PositiveIntegerField(default=0)  # 0 = unlimited
    uses_count = models.PositiveIntegerField(default=0)
    valid_from = models.DateTimeField(default=timezone.now)
    valid_to = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def is_active(self):
        now = timezone.now()
        if self.valid_to and now > self.valid_to:
            return False
        if self.valid_from and now < self.valid_from:
            return False
        if self.max_uses and self.uses_count >= self.max_uses:
            return False
        return True

    def __str__(self):
        return self.code
