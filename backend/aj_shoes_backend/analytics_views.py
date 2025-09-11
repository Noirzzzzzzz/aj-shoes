from datetime import datetime, timedelta
from decimal import Decimal
from io import BytesIO
import csv

from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Sum, Count, F, DecimalField, IntegerField, ExpressionWrapper, Value
from django.db.models.functions import ExtractYear, ExtractMonth, ExtractWeek, ExtractQuarter, TruncDate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

from orders.models import Order, OrderItem
from catalog.models import Product, Brand, Category, Variant

def _parse_params(request):
    # dates: YYYY-MM-DD
    def parse_date(s, default=None):
        if not s:
            return default
        return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.get_current_timezone())

    q = request.query_params
    date_from = parse_date(q.get("date_from"), timezone.now() - timedelta(days=30))
    date_to = parse_date(q.get("date_to"), timezone.now())
    group = (q.get("group") or "day").lower()
    brands = [int(x) for x in (q.get("brands") or "").split(",") if x.strip().isdigit()]
    categories = [int(x) for x in (q.get("categories") or "").split(",") if x.strip().isdigit()]
    coupons = [x.strip() for x in (q.get("coupons") or "").split(",") if x.strip()]
    limit = int(q.get("limit") or 10)
    return date_from, date_to, group, brands, categories, coupons, limit

def _base_queryset(date_from, date_to, brands, categories, coupons):
    # Work with OrderItem lines
    items = OrderItem.objects.select_related(
        "order", "product", "variant", "product__brand", "product__category", "order__coupon"
    ).filter(
        order__created_at__gte=date_from,
        order__created_at__lte=date_to
    )
    if brands:
        items = items.filter(product__brand_id__in=brands)
    if categories:
        items = items.filter(product__category_id__in=categories)
    if coupons:
        items = items.filter(order__coupon__code__in=coupons)
    return items

def _money_expr():
    return ExpressionWrapper(F("price") * F("quantity"), output_field=DecimalField(max_digits=12, decimal_places=2))

class SalesSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        date_from, date_to, group, brands, categories, coupons, limit = _parse_params(request)
        items = _base_queryset(date_from, date_to, brands, categories, coupons)

        # Totals
        totals = items.aggregate(
            revenue=Sum(_money_expr()),
            items=Sum("quantity", output_field=IntegerField()),
            orders=Count("order", distinct=True),
        )

        # Grouped series
        if group == "day":
            qs = items.annotate(g=TruncDate("order__created_at")).values("g")
        elif group == "month":
            qs = items.annotate(y=ExtractYear("order__created_at"), m=ExtractMonth("order__created_at")).values("y","m")
        elif group == "week":
            qs = items.annotate(y=ExtractYear("order__created_at"), w=ExtractWeek("order__created_at")).values("y","w")
        elif group == "quarter":
            qs = items.annotate(y=ExtractYear("order__created_at"), q=ExtractQuarter("order__created_at")).values("y","q")
        else:
            qs = items.annotate(g=TruncDate("order__created_at")).values("g")

        if group == "day":
            series_qs = qs.annotate(
                revenue=Sum(_money_expr()), items=Sum("quantity"), orders=Count("order", distinct=True)
            ).order_by("g")
            series = [{
                "label": x["g"].strftime("%Y-%m-%d"),
                "revenue": float(x["revenue"] or 0),
                "items": x["items"] or 0,
                "orders": x["orders"] or 0,
            } for x in series_qs]
        elif group == "month":
            series_qs = qs.annotate(
                revenue=Sum(_money_expr()), items=Sum("quantity"), orders=Count("order", distinct=True)
            ).order_by("y","m")
            series = [{
                "label": f"{x['y']}-{x['m']:02d}",
                "revenue": float(x["revenue"] or 0),
                "items": x["items"] or 0,
                "orders": x["orders"] or 0,
            } for x in series_qs]
        elif group == "week":
            series_qs = qs.annotate(
                revenue=Sum(_money_expr()), items=Sum("quantity"), orders=Count("order", distinct=True)
            ).order_by("y","w")
            series = [{
                "label": f"{x['y']}-W{x['w']:02d}",
                "revenue": float(x["revenue"] or 0),
                "items": x["items"] or 0,
                "orders": x["orders"] or 0,
            } for x in series_qs]
        else:  # quarter
            series_qs = qs.annotate(
                revenue=Sum(_money_expr()), items=Sum("quantity"), orders=Count("order", distinct=True)
            ).order_by("y","q")
            series = [{
                "label": f"{x['y']}-Q{x['q']}",
                "revenue": float(x["revenue"] or 0),
                "items": x["items"] or 0,
                "orders": x["orders"] or 0,
            } for x in series_qs]

        # Breakdown by brand
        by_brand = list(items.values("product__brand_id", "product__brand__name").annotate(
            revenue=Sum(_money_expr()), items=Sum("quantity")
        ).order_by("-revenue"))
        for b in by_brand:
            b["revenue"] = float(b["revenue"] or 0)

        # Breakdown by category
        by_cat = list(items.values("product__category_id", "product__category__name").annotate(
            revenue=Sum(_money_expr()), items=Sum("quantity")
        ).order_by("-revenue"))
        for c in by_cat:
            c["revenue"] = float(c["revenue"] or 0)

        # Breakdown by coupon
        by_coupon = list(items.values("order__coupon__code").annotate(
            revenue=Sum(_money_expr()), items=Sum("quantity")
        ).order_by("-revenue"))
        for c in by_coupon:
            c["revenue"] = float(c["revenue"] or 0)

        # Top products
        top = list(items.values("product_id","product__name_en").annotate(
            qty=Sum("quantity"), revenue=Sum(_money_expr())
        ).order_by("-revenue")[:limit])
        for t in top:
            t["revenue"] = float(t["revenue"] or 0)

        return Response({
            "totals": {
                "revenue": float(totals.get("revenue") or 0),
                "items": totals.get("items") or 0,
                "orders": totals.get("orders") or 0
            },
            "series": series,
            "breakdown": {
                "brands": by_brand,
                "categories": by_cat,
                "coupons": by_coupon
            },
            "top_products": top,
            "currency": "THB"
        })

class TopProductsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        date_from, date_to, group, brands, categories, coupons, limit = _parse_params(request)
        items = _base_queryset(date_from, date_to, brands, categories, coupons)
        top = list(items.values("product_id","product__name_en").annotate(
            qty=Sum("quantity"), revenue=Sum(_money_expr())
        ).order_by("-revenue")[:limit])
        for t in top:
            t["revenue"] = float(t["revenue"] or 0)
        return Response(top)

def _export_items_queryset(request):
    date_from, date_to, group, brands, categories, coupons, limit = _parse_params(request)
    return _base_queryset(date_from, date_to, brands, categories, coupons)

class ExportCSVView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        items = _export_items_queryset(request)
        # CSV header
        header = ["order_id","created_at","product_id","name_en","brand","category","color","size_eu","size_cm","quantity","price","line_total","coupon"]
        resp = HttpResponse(content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = "attachment; filename=ajshoes_sales.csv"
        writer = csv.writer(resp)
        writer.writerow(header)
        for it in items:
            line_total = (it.price or 0) * it.quantity
            writer.writerow([
                it.order_id,
                it.order.created_at.isoformat(),
                it.product_id,
                it.product.name_en,
                getattr(it.product.brand, "name", ""),
                getattr(it.product.category, "name", ""),
                it.variant.color,
                it.variant.size_eu,
                it.variant.size_cm,
                it.quantity,
                float(it.price or 0),
                float(line_total),
                getattr(getattr(it.order, "coupon", None), "code", ""),
            ])
        return resp

class ExportXLSXView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        try:
            from openpyxl import Workbook
        except Exception:
            return HttpResponse("openpyxl is required. Run: pip install openpyxl>=3.1.5", status=500, content_type="text/plain")
        items = _export_items_queryset(request)
        wb = Workbook()
        ws = wb.active
        ws.title = "Sales"
        header = ["order_id","created_at","product_id","name_en","brand","category","color","size_eu","size_cm","quantity","price","line_total","coupon"]
        ws.append(header)
        for it in items:
            line_total = (it.price or 0) * it.quantity
            ws.append([
                it.order_id,
                it.order.created_at.isoformat(),
                it.product_id,
                it.product.name_en,
                getattr(it.product.brand, "name", ""),
                getattr(it.product.category, "name", ""),
                it.variant.color,
                it.variant.size_eu,
                it.variant.size_cm,
                it.quantity,
                float(it.price or 0),
                float(line_total),
                getattr(getattr(it.order, "coupon", None), "code", ""),
            ])
        bio = BytesIO()
        wb.save(bio)
        bio.seek(0)
        resp = HttpResponse(bio.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        resp["Content-Disposition"] = "attachment; filename=ajshoes_sales.xlsx"
        return resp

class ExportStockCSVView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        from catalog.models import Variant
        from django.http import StreamingHttpResponse
        header = ["product_id","name_en","brand","category","color","size_eu","size_cm","stock"]
        resp = HttpResponse(content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = "attachment; filename=ajshoes_stock.csv"
        writer = csv.writer(resp)
        writer.writerow(header)
        qs = Variant.objects.select_related("product","product__brand","product__category").order_by("product_id","color","size_eu","size_cm")
        for v in qs:
            writer.writerow([
                v.product_id,
                v.product.name_en,
                getattr(v.product.brand, "name", ""),
                getattr(v.product.category, "name", ""),
                v.color, v.size_eu, v.size_cm,
                v.stock
            ])
        return resp
