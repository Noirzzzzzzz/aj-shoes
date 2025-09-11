from rest_framework import serializers
from .models import Coupon

class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = ["id", "code", "discount_type", "percent_off", "min_spend", "max_uses", "uses_count", "valid_from", "valid_to"]
