from django.contrib import admin
from .models import Coupon

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ("code", "discount_type", "percent_off", "min_spend", "max_uses", "uses_count", "valid_from", "valid_to")
    search_fields = ("code",)
