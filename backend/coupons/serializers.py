# serializers.py — READY TO REPLACE
from rest_framework import serializers
from .models import Coupon, UserCoupon

class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = ["id", "code", "discount_type", "percent_off", "min_spend",
                  "max_uses", "uses_count", "valid_from", "valid_to"]

class CouponCenterSerializer(serializers.ModelSerializer):
    remaining = serializers.SerializerMethodField()

    class Meta:
        model = Coupon
        fields = ["id", "code", "discount_type", "percent_off", "min_spend",
                  "max_uses", "uses_count", "valid_from", "valid_to", "remaining"]

    def get_remaining(self, obj):
        return obj.remaining()

class UserCouponSerializer(serializers.ModelSerializer):
    code = serializers.CharField(source="coupon.code", read_only=True)
    discount_type = serializers.CharField(source="coupon.discount_type", read_only=True)
    percent_off = serializers.IntegerField(source="coupon.percent_off", read_only=True)
    valid_to = serializers.DateTimeField(source="coupon.valid_to", read_only=True)

    class Meta:
        model = UserCoupon
        fields = ["id", "code", "discount_type", "percent_off", "valid_to", "used", "claimed_at"]
