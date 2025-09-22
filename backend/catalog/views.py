# catalog/views.py
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.cache import cache

from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.db.models import Q, CharField
from django.db.models.functions import Concat
from django.db.models import Value as V

from .models import Brand, Category, Product
from .serializers import BrandSerializer, CategorySerializer, ProductSerializer
from .filters import ProductFilter

class BrandViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Brand.objects.all().order_by("name")
    serializer_class = BrandSerializer

    # GET /api/catalog/brands/rows/?limit=12
    @action(detail=False, methods=["get"])
    def rows(self, request):
        try:
            limit = max(1, min(int(request.query_params.get("limit", 12)), 24))
        except Exception:
            limit = 12

        brands = Brand.objects.filter(products__is_active=True).distinct().order_by("name")
        rows = []
        for b in brands:
            qs = (Product.objects.filter(is_active=True, brand=b)
                  .select_related("brand", "category")
                  .prefetch_related("images", "variants")
                  .order_by("-popularity", "-updated_at", "id")[:limit])
            rows.append({
                "title": b.name,
                "products": ProductSerializer(qs, many=True, context={"request": request}).data
            })
        return Response({"rows": rows})

class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all().order_by("name")
    serializer_class = CategorySerializer

    # GET /api/catalog/categories/rows/?limit=12
    @action(detail=False, methods=["get"])
    def rows(self, request):
        try:
            limit = max(1, min(int(request.query_params.get("limit", 12)), 24))
        except Exception:
            limit = 12

        cats = Category.objects.filter(products__is_active=True).distinct().order_by("name")
        rows = []
        for c in cats:
            qs = (Product.objects.filter(is_active=True, category=c)
                  .select_related("brand", "category")
                  .prefetch_related("images", "variants")
                  .order_by("-popularity", "-updated_at", "id")[:limit])
            rows.append({
                "title": c.name,
                "products": ProductSerializer(qs, many=True, context={"request": request}).data
            })
        return Response({"rows": rows})

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (
        Product.objects.filter(is_active=True)
        .select_related("brand","category")
        .prefetch_related("images","variants")
    )
    serializer_class = ProductSerializer
    filterset_class = ProductFilter
    search_fields = ["name", "description",]
    ordering_fields = ["base_price","popularity","sale_percent"]
    ordering = ["-popularity"]

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())

        ids = request.query_params.get("ids")
        if ids:
            try:
                id_list = [int(x) for x in ids.split(",") if x.strip().isdigit()]
            except ValueError:
                id_list = []
            qs = qs.filter(id__in=id_list) if id_list else qs.none()

        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True)
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True)
        return Response(ser.data)

    @action(detail=False, methods=["get"])
    def home_rows(self, request):
        cache_key = "home_rows_v2"
        data = cache.get(cache_key)
        if not data:
            recommended = Product.objects.filter(is_active=True, is_recommended=True)[:12]
            trending = Product.objects.filter(is_active=True).order_by("-popularity")[:12]
            personalized = Product.objects.filter(is_active=True).order_by("-updated_at")[:12]
            data = {
                "recommended": self.get_serializer(recommended, many=True).data,
                "trending": self.get_serializer(trending, many=True).data,
                "personalized": self.get_serializer(personalized, many=True).data,
            }
            cache.set(cache_key, data, 60)
        return Response(data)

class ProductSuggest(APIView):
    permission_classes = [AllowAny]
    def get(self, request, *args, **kwargs):
        q = (request.query_params.get("q") or "").strip()
        try:
            limit = max(1, min(int(request.query_params.get("limit", 8)), 20))
        except Exception:
            limit = 8
        if not q:
            return Response([])

        qs = (
            Product.objects.select_related("brand", "category")
            .filter(
                Q(name__icontains=q)
                | Q(description__icontains=q)
                | Q(brand__name__icontains=q)
                | Q(category__name__icontains=q)
            )
            .annotate(label=Concat("name", V(" — "), "brand__name", output_field=CharField()))
            .order_by("-popularity", "name")[: limit * 2]
        )

        results, seen = [], set()
        for p in qs:
            value = (p.name or "").strip()
            if not value:
                continue
            key = value.lower()
            if key in seen:
                continue
            seen.add(key)
            results.append({"id": p.id, "label": getattr(p, "label", value) or value, "value": value})
            if len(results) >= limit:
                break

        if len(results) < limit:
            for b in Brand.objects.filter(name__icontains=q).order_by("name")[: limit]:
                name = b.name.strip()
                if name and name.lower() not in seen:
                    results.append({"label": name, "value": name})
                    seen.add(name.lower())
                    if len(results) >= limit:
                        break

        if len(results) < limit:
            for c in Category.objects.filter(name__icontains=q).order_by("name")[: limit]:
                name = c.name.strip()
                if name and name.lower() not in seen:
                    results.append({"label": name, "value": name})
                    seen.add(name.lower())
                    if len(results) >= limit:
                        break

        return Response(results[:limit])
