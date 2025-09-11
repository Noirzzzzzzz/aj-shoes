from django.db.models import Q
import django_filters as filters
from .models import Product


class ProductFilter(filters.FilterSet):
    # ค้นหาข้อความ
    search = filters.CharFilter(method="filter_search")

    # ฟิลเตอร์พื้นฐาน
    brand = filters.CharFilter(field_name="brand__name", lookup_expr="iexact")
    min_price = filters.NumberFilter(field_name="base_price", lookup_expr="gte")
    max_price = filters.NumberFilter(field_name="base_price", lookup_expr="lte")

    # เฉพาะสินค้าที่ลดราคา
    discount_only = filters.BooleanFilter(method="filter_discount_only")
    on_sale = filters.BooleanFilter(method="filter_discount_only")

    class Meta:
        model = Product
        fields = [
            "brand",
            "min_price",
            "max_price",
            "discount_only",
            "on_sale",
        ]

    def filter_search(self, qs, name, value: str):
        if not value:
            return qs
        return qs.filter(Q(name__icontains=value) | Q(description__icontains=value))

    def filter_discount_only(self, qs, name, value: bool):
        """
        สินค้าลดราคา = sale_percent > 0
        """
        if not value:
            return qs
        return qs.filter(sale_percent__gt=0)
