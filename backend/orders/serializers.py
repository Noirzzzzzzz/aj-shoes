# orders/serializers.py
from rest_framework import serializers
from .models import Address, Cart, CartItem, Order, OrderItem, Favorite, Review, PaymentMethod, OrderPayment
from catalog.serializers import VariantSerializer
from catalog.models import Product  # ใช้สร้าง ProductBriefSerializer
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
        # หารายการรูปจากความสัมพันธ์ที่หาเจอชื่อแรกที่มีอยู่จริง
        rel_qs = None
        for attr in ("images", "product_images", "productimage_set"):
            rel = getattr(obj, attr, None)
            if rel is not None:
                # ถ้าเป็น RelatedManager จะมี .all()
                rel_qs = list(rel.all()) if hasattr(rel, "all") else list(rel)
                if rel_qs:
                    break

        rel_qs = rel_qs or []

        out = []
        for im in rel_qs:
            # รองรับหลายรูปแบบของฟิลด์เก็บรูป
            url = getattr(im, "image_url", None)
            if not url:
                url = getattr(im, "url", None)
            if not url:
                img_field = getattr(im, "image", None)
                if hasattr(img_field, "url"):
                    url = img_field.url
            if not url:
                # ลองหาจาก field อื่นๆ
                for field_name in ['file', 'photo', 'picture']:
                    field_val = getattr(im, field_name, None)
                    if field_val and hasattr(field_val, 'url'):
                        url = field_val.url
                        break
                        
            if not url:
                # ไม่มี url ก็ข้าม
                continue

            # แปลง relative URL เป็น full URL
            if url.startswith('/'):
                # ใช้ request context เพื่อสร้าง full URL
                request = self.context.get('request')
                if request:
                    url = request.build_absolute_uri(url)
                else:
                    # fallback: ใช้ domain จาก settings หรือ hardcode
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
    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = ["id", "status", "shipping_carrier", "shipping_cost", "coupon", "total", "items", "created_at"]


# ---------- Payment ----------
class PaymentMethodSerializer(serializers.ModelSerializer):
    qr_code_image = serializers.SerializerMethodField()
    
    class Meta:
        model = PaymentMethod
        fields = ["id", "name", "bank_name", "account_name", "account_number", "qr_code_image"]
    
    def get_qr_code_image(self, obj):
        if obj.qr_code_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.qr_code_image.url)
            return obj.qr_code_image.url
        return None

class PaymentInfoSerializer(serializers.ModelSerializer):
    qr_code_image = serializers.CharField(source="payment_method.qr_code_image.url", read_only=True)
    bank_name = serializers.CharField(source="payment_method.bank_name", read_only=True)
    account_name = serializers.CharField(source="payment_method.account_name", read_only=True)
    account_number = serializers.CharField(source="payment_method.account_number", read_only=True)
    
    class Meta:
        model = OrderPayment
        fields = ["id", "total_amount", "expires_at", "qr_code_image", "bank_name", "account_name", "account_number"]

class PaymentSlipUploadSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    slip = serializers.ImageField()
    
    def validate_order_id(self, value):
        user = self.context['request'].user
        try:
            payment = OrderPayment.objects.get(order_id=value, order__user=user)
            if payment.status != 'pending':
                raise serializers.ValidationError("Payment slip already uploaded or verified.")
            if payment.is_expired():
                raise serializers.ValidationError("Payment has expired.")
            return value
        except OrderPayment.DoesNotExist:
            raise serializers.ValidationError("Invalid order or not found.")