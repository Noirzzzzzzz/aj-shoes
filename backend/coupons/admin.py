# admin.py — READY TO REPLACE
from django.contrib import admin
from .models import Coupon, UserCoupon

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ("code", "discount_type", "percent_off", "min_spend", "max_uses", "uses_count", "valid_from", "valid_to")
    search_fields = ("code",)

@admin.register(UserCoupon)
class UserCouponAdmin(admin.ModelAdmin):
    list_display = ("user", "coupon", "used", "claimed_at")
    list_filter = ("used",)
    search_fields = ("coupon__code", "user__username", "user__email")
