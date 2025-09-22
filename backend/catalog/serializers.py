# backend/catalog/serializers.py
from rest_framework import serializers
from .models import Brand, Category, Product, ProductImage, Variant

# ---------- Base / Simple serializers ----------
class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["id", "name"]


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = [
            "id",
            "file",
            "url_source",
            "alt",
            "is_cover",
            "sort_order",
            "color",
            "width",
            "height",
            "checksum",
        ]
        read_only_fields = ["width", "height", "checksum"]


class VariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Variant
        fields = ["id", "color", "size_eu", "size_cm", "stock"]


# ---------- Product (Read) ----------
class ProductSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    variants = VariantSerializer(many=True, read_only=True)

    # คำนวณราคา sale
    sale_price = serializers.SerializerMethodField()

    # ดาวเฉลี่ย + จำนวนรีวิว (มาจากแอป orders)
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "brand",
            "category",
            "name",
            "description",
            "base_price",
            "sale_percent",
            "sale_price",
            "popularity",
            "is_active",
            "is_recommended",
            "average_rating",
            "review_count",
            "images",
            "variants",
        ]

    def get_sale_price(self, obj):
        # แปลงเป็น string เพื่อความสม่ำเสมอกับ frontend (หลีกเลี่ยง Decimal serialize ปน)
        return str(obj.sale_price)

    def get_average_rating(self, obj):
        # local import กัน circular (orders.models.Review อ้างถึง Product)
        from django.db.models import Avg
        from orders import models as order_models

        agg = order_models.Review.objects.filter(product=obj).aggregate(avg=Avg("rating"))
        avg = agg.get("avg") or 0
        return round(float(avg), 1)

    def get_review_count(self, obj):
        from orders import models as order_models

        return order_models.Review.objects.filter(product=obj).count()


# ---------- Product (Write) สำหรับ admin_api ----------
class ProductWriteSerializer(serializers.ModelSerializer):
    """
    ใช้ใน admin_api สำหรับสร้าง/แก้ไขสินค้า
    (admin_api ของคุณอ้างอิงชื่อนี้อยู่)
    """
    class Meta:
        model = Product
        fields = [
            "id",
            "brand",
            "category",
            "name",
            "description",
            "base_price",
            "sale_percent",
            "is_active",
            "is_recommended",
            "popularity",
        ]
