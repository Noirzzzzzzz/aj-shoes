# orders/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AddressViewSet, CartViewSet, FavoriteViewSet, ReviewViewSet, MyOrdersView

router = DefaultRouter()
router.register(r"addresses", AddressViewSet, basename="address")
router.register(r"favorites", FavoriteViewSet, basename="favorite")
# ✅ alias ชั่วคราวให้ของเดิมยังใช้ได้
router.register(r"wishlist", FavoriteViewSet, basename="wishlist-compat")
router.register(r"reviews", ReviewViewSet, basename="review")

# Cart ViewSet routes
cart_list = CartViewSet.as_view({"get": "list", "post": "create"})
cart_item_update = CartViewSet.as_view({"patch": "partial_update", "delete": "destroy"})
apply_coupon = CartViewSet.as_view({"post": "apply_coupon"})
checkout = CartViewSet.as_view({"post": "checkout"})
upload_payment_slip = CartViewSet.as_view({"post": "upload_payment_slip"})  # ✅ เพิ่ม
clear_cart_items = CartViewSet.as_view({"post": "clear_cart_items"})

urlpatterns = [
    path("", include(router.urls)),
    path("cart/", cart_list),
    path("cart/<int:pk>/", cart_item_update),
    path("cart/apply-coupon/", apply_coupon),
    path("cart/checkout/", checkout),
    path("upload-payment-slip/", upload_payment_slip),  # ✅ เพิ่ม
    path("cart/clear-cart-items/", clear_cart_items),  # ✅ เพิ่ม
    path("history/", MyOrdersView.as_view()),
]