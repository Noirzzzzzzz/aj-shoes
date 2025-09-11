from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import CouponViewSet

router = DefaultRouter()
router.register(r"", CouponViewSet, basename="coupon")

urlpatterns = [
    path("coupons/", include(router.urls)),
]
