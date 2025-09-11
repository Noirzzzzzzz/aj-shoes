from rest_framework import serializers
from .models import Brand, Category, Product, ProductImage, Variant


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["id", "name"]


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name"]


class ProductImageSerializer(serializers.ModelSerializer):
    """
    ส่งกลับทั้งทางเลือกของรูป:
    - file: เส้นทางไฟล์ในระบบ (ถ้าตั้ง MEDIA_URL ไว้ DRF จะให้ URL ออกมา)
    - url_source: URL ที่ใช้ตอนนำเข้า (เก็บเป็นข้อมูลอ้างอิง ไม่ใช้แสดงผล)
    """
    class Meta:
        model = ProductImage
        fields = [
            "id",
            "file",
            "url_source",
            "alt",
            "is_cover",
            "sort_order",
            "width",
            "height",
            "checksum",
        ]
        read_only_fields = ["width", "height", "checksum"]


class VariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Variant
        fields = ["id", "color", "size_eu", "size_cm", "stock"]


class ProductSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    variants = VariantSerializer(many=True, read_only=True)
    sale_price = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "brand", "category",
            "name_en","name_th","description_en","description_th",
            "base_price", "sale_percent", "sale_price",
            "popularity", "is_active", "images", "variants"
        ]

    def get_sale_price(self, obj):
        return str(obj.sale_price)


class ProductWriteSerializer(serializers.ModelSerializer):
    """ใช้สำหรับ create/update จากฝั่งแอดมิน"""
    class Meta:
        model = Product
        fields = [
            "id", "brand", "category",
            "name_en","name_th","description_en","description_th",
            "base_price", "sale_percent",
            "is_active"
        ]
