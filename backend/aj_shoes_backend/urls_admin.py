from django.urls import path, include
from rest_framework.routers import DefaultRouter
from catalog.admin_api import ProductAdminViewSet, ProductImageAdminViewSet, VariantAdminViewSet
from coupons.admin_api import CouponAdminViewSet
from accounts.admin_api import UserAdminViewSet
from aj_shoes_backend.analytics_views import SalesSummaryView, TopProductsView, ExportCSVView, ExportXLSXView, ExportStockCSVView

router = DefaultRouter()
router.register(r"catalog/products", ProductAdminViewSet, basename="admin-product")
router.register(r"catalog/images", ProductImageAdminViewSet, basename="admin-image")
router.register(r"catalog/variants", VariantAdminViewSet, basename="admin-variant")
router.register(r"coupons", CouponAdminViewSet, basename="admin-coupon")
router.register(r"users", UserAdminViewSet, basename="admin-user")

urlpatterns = [
    path("", include(router.urls)),
    path("analytics/sales_summary/", SalesSummaryView.as_view()),
    path("analytics/top_products/", TopProductsView.as_view()),
    path("analytics/export.csv", ExportCSVView.as_view()),
    path("analytics/export.xlsx", ExportXLSXView.as_view()),
    path("analytics/export_stock.csv", ExportStockCSVView.as_view()),
]
