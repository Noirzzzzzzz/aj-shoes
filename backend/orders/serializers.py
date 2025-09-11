# orders/serializers.py
from rest_framework import serializers
from django.utils import timezone
from .models import Address, Cart, CartItem, Order, OrderItem, Favorite, Review, PaymentConfig
from catalog.serializers import VariantSerializer
from catalog.models import Product
from coupons.models import Coupon


# ---------- Product (Brief) with images ----------
class ProductBriefSerializer(serializers.ModelSerializer):
    images = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ["id", "name_en", "base_price", "sale_price", "sale_percent", "images"]

    def get_images(self, obj):
        """
        ดึงรูปจากความสัมพันธ์ที่เป็นไปได้หลายชื่อ:
        - obj.images (เช่น related_name="images")
        - obj.product_images
        - obj.productimage_set (default related_name)
        และ map ให้อยู่ในรูปแบบ [{image_url, is_cover}] พร้อม full URL
        """
        rel_qs = None
        for attr in ("images", "product_images", "productimage_set"):
            rel = getattr(obj, attr, None)
            if rel is not None:
                rel_qs = list(rel.all()) if hasattr(rel, "all") else list(rel)
                if rel_qs:
                    break

        rel_qs = rel_qs or []

        out = []
        for im in rel_qs:
            url = getattr(im, "image_url", None)
            if not url:
                url = getattr(im, "url", None)
            if not url:
                img_field = getattr(im, "image", None)
                if hasattr(img_field, "url"):
                    url = img_field.url
            if not url:
                for field_name in ['file', 'photo', 'picture']:
                    field_val = getattr(im, field_name, None)
                    if field_val and hasattr(field_val, 'url'):
                        url = field_val.url
                        break
                        
            if not url:
                continue

            if url.startswith('/'):
                request = self.context.get('request')
                if request:
                    url = request.build_absolute_uri(url)
                else:
                    from django.conf import settings
                    domain = getattr(settings, 'SITE_URL', 'http://localhost:8000')
                    url = domain.rstrip('/') + url

            out.append(
                {
                    "image_url": url,
                    "is_cover": bool(getattr(im, "is_cover", False)),
                }
            )
        return out


# ---------- Payment Configuration ----------
class PaymentConfigSerializer(serializers.ModelSerializer):
    qr_code_url = serializers.SerializerMethodField()

    class Meta:
        model = PaymentConfig
        fields = ["id", "bank_name", "account_name", "account_number", "qr_code_url"]

    def get_qr_code_url(self, obj):
        if obj.qr_code_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.qr_code_image.url)
            return obj.qr_code_image.url
        return None


# ---------- Address ----------
class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ["id", "full_name", "phone", "address", "province", "postal_code", "is_default"]


# ---------- Cart / CartItem ----------
class CartItemSerializer(serializers.ModelSerializer):
    product_detail = ProductBriefSerializer(source="product", read_only=True)
    variant_detail = VariantSerializer(source="variant", read_only=True)

    class Meta:
        model = CartItem
        fields = ["id", "product", "variant", "quantity", "product_detail", "variant_detail"]


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    coupon_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Cart
        fields = ["id", "items", "coupon", "coupon_code"]

    def update(self, instance, validated_data):
        code = validated_data.pop("coupon_code", "").strip()
        if code:
            try:
                c = Coupon.objects.get(code__iexact=code)
                if not c.is_active():
                    raise serializers.ValidationError("Coupon inactive or expired.")
                instance.coupon = c
                instance.save()
            except Coupon.DoesNotExist:
                raise serializers.ValidationError("Coupon not found.")
        return instance


# ---------- Favorite / Review ----------
class FavoriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Favorite
        fields = ["id", "product", "created_at"]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        user = self.context["request"].user
        product = validated_data["product"]
        obj, _ = Favorite.objects.get_or_create(user=user, product=product)
        return obj


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ["id", "product", "rating", "comment", "created_at"]


# ---------- Order ----------
class OrderItemSerializer(serializers.ModelSerializer):
    product_detail = ProductBriefSerializer(source="product", read_only=True)
    variant_detail = VariantSerializer(source="variant", read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_detail", "variant", "variant_detail", "price", "quantity"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payment_deadline_formatted = serializers.SerializerMethodField()
    time_remaining = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    payment_slip_url = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "status", "shipping_carrier", "shipping_cost", "coupon", "total", 
            "items", "created_at", "payment_deadline", "payment_deadline_formatted", 
            "time_remaining", "is_expired", "payment_slip_url"
        ]

    def get_payment_deadline_formatted(self, obj):
        if obj.payment_deadline:
            return obj.payment_deadline.strftime("%d/%m/%Y, %H:%M:%S")
        return None

    def get_time_remaining(self, obj):
        if obj.payment_deadline and not obj.is_payment_expired:
            diff = obj.payment_deadline - timezone.now()
            total_seconds = int(diff.total_seconds())
            if total_seconds > 0:
                minutes = total_seconds // 60
                seconds = total_seconds % 60
                return f"{minutes}:{seconds:02d}"
        return "00:00"

    def get_is_expired(self, obj):
        return obj.is_payment_expired

    def get_payment_slip_url(self, obj):
        if obj.payment_slip:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.payment_slip.url)
            return obj.payment_slip.url
        return None