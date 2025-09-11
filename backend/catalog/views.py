from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.cache import cache

from .models import Brand, Category, Product, Variant
from .serializers import BrandSerializer, CategorySerializer, ProductSerializer
from .filters import ProductFilter


class BrandViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Brand.objects.all().order_by("name")
    serializer_class = BrandSerializer


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all().order_by("name")
    serializer_class = CategorySerializer


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.filter(is_active=True).select_related("brand", "category").prefetch_related("images", "variants")
    serializer_class = ProductSerializer
    filterset_class = ProductFilter
    search_fields = ["name_en", "name_th", "description_en", "description_th", "brand__name"]
    ordering_fields = ["base_price", "popularity", "sale_percent"]
    ordering = ["-popularity"]

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())

        # 🔹 รองรับ ?ids=1,2,3
        ids = request.query_params.get("ids")
        if ids:
            try:
                id_list = [int(x) for x in ids.split(",") if x.strip().isdigit()]
            except ValueError:
                id_list = []
            if id_list:
                qs = qs.filter(id__in=id_list)
            else:
                qs = qs.none()

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def home_rows(self, request):
        cache_key = "home_rows_v1"
        data = None
        try:
            data = cache.get(cache_key)
        except Exception:
            data = None  # ถ้า Redis/Cache พัง → ไม่พังระบบ

        if not data:
            recommended = Product.objects.filter(is_active=True).order_by("-popularity")[:12]
            trending = Product.objects.filter(is_active=True).order_by("-updated_at")[:12]
            personalized = Product.objects.filter(is_active=True).order_by("brand__name")[:12]
            data = {
                "recommended": self.get_serializer(recommended, many=True).data,
                "trending": self.get_serializer(trending, many=True).data,
                "personalized": self.get_serializer(personalized, many=True).data,
            }
            try:
                cache.set(cache_key, data, 60)
            except Exception:
                pass
        return Response(data)
