# catalog/filters.py  (ready-to-replace)
from django.db.models import Q
import django_filters as filters
from .models import Product

def _truthy(v) -> bool:
    if isinstance(v, bool):
        return v
    if v is None:
        return False
    return str(v).strip().lower() in {"1","true","on","yes"}

class ProductFilter(filters.FilterSet):
    search = filters.CharFilter(method="filter_search")

    brand = filters.CharFilter(field_name="brand__name", lookup_expr="iexact")
    category = filters.CharFilter(field_name="category__name", lookup_expr="iexact")  # ✅ ใหม่
    brand_id = filters.NumberFilter(field_name="brand_id")                              # ทางเลือก
    category_id = filters.NumberFilter(field_name="category_id")                        # ทางเลือก
    min_price = filters.NumberFilter(field_name="base_price", lookup_expr="gte")
    max_price = filters.NumberFilter(field_name="base_price", lookup_expr="lte")

    discount_only = filters.CharFilter(method="filter_discount_only")
    on_sale = filters.CharFilter(method="filter_discount_only")

    class Meta:
        model = Product
        fields = ["brand", "category", "brand_id", "category_id",
                  "min_price", "max_price", "discount_only", "on_sale"]

    def filter_search(self, qs, name, value: str):
        if not value:
            return qs
        return qs.filter(
            Q(name__icontains=value)
            | Q(description__icontains=value)
            | Q(brand__name__icontains=value)
            | Q(category__name__icontains=value)
        ).distinct()

    def filter_discount_only(self, qs, name, value):
        if not _truthy(value):
            return qs
        # ลดราคา = sale_percent > 0
        return qs.filter(sale_percent__gt=0)
