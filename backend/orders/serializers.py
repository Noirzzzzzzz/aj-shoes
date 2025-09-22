# orders/serializers.py
from rest_framework import serializers
from django.utils import timezone
from .models import Address, Cart, CartItem, Order, OrderItem, Favorite, Review, PaymentConfig
from catalog.serializers import VariantSerializer
from catalog.models import Product
from coupons.models import Coupon


# ---------- Product (Brief) with images ----------
class ProductBriefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name_en = serializers.SerializerMethodField()
    base_price = serializers.SerializerMethodField()
    sale_price = serializers.SerializerMethodField()
    sale_percent = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()

    # ----- safe getters -----
    def get_name_en(self, obj):
        # รองรับหลายชื่อฟิลด์ (เผื่อโมเดล/serializer ตัวอื่น)
        return (
            getattr(obj, "name", None)
            or getattr(obj, "name", None)
            or getattr(obj, "title", "")
            or ""
        )

    def get_base_price(self, obj):
        val = getattr(obj, "base_price", None)
        return str(val) if val is not None else "0"

    def get_sale_price(self, obj):
        # รองรับทั้ง property และฟิลด์จริง
        val = getattr(obj, "sale_price", None)
        if val is not None:
            return str(val)
        # คิดสำรองจาก base + sale_percent
        base = float(getattr(obj, "base_price", 0) or 0)
        percent = int(getattr(obj, "sale_percent", 0) or 0)
        return str(round(base * (100 - percent) / 100, 2))

    def get_sale_percent(self, obj):
        return int(getattr(obj, "sale_percent", 0) or 0)

    def get_images(self, obj):
        """
        ดึงรูปจากความสัมพันธ์ที่เป็นไปได้หลายชื่อ:
        - obj.images (เช่น related_name="images")
        - obj.product_images
        - obj.productimage_set (default related_name)
        และ map ให้อยู่ในรูป [{image_url, is_cover}] พร้อมทำเป็น absolute URL ได้
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
        request = self.context.get("request")
        for im in rel_qs:
            url = getattr(im, "image_url", None) or getattr(im, "url", None)
            if not url:
                for f in ("image", "file", "photo", "picture"):
                    val = getattr(im, f, None)
                    if val and hasattr(val, "url"):
                        url = val.url
                        break
            if not url:
                continue

            if url.startswith("/") and request:
                url = request.build_absolute_uri(url)
            out.append({
                "image_url": url,
                "is_cover": bool(getattr(im, "is_cover", False)),
            })
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
    username = serializers.SerializerMethodField()  # ✅ ใหม่

    class Meta:
        model = Review
        fields = ["id", "product", "rating", "comment", "created_at", "updated_at", "username"]  # ✅ เพิ่ม updated_at, username
        read_only_fields = ["id", "created_at", "updated_at", "username"]

    def get_username(self, obj):
        # ป้องกันกรณี user ถูกลบหรือไม่มี username
        return getattr(obj.user, "username", "") or ""


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