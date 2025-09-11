# orders/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AddressViewSet, 
    CartViewSet, 
    FavoriteViewSet, 
    ReviewViewSet, 
    MyOrdersView,
    OrderViewSet,
    PaymentConfigView
)

router = DefaultRouter()
router.register(r"addresses", AddressViewSet, basename="address")
router.register(r"favorites", FavoriteViewSet, basename="favorite")
# ✅ alias ชั่วคราวให้ของเดิมยังใช้ได้
router.register(r"wishlist", FavoriteViewSet, basename="wishlist-compat")
router.register(r"reviews", ReviewViewSet, basename="review")

cart_list = CartViewSet.as_view({"get": "list", "post": "create"})
cart_item_update = CartViewSet.as_view({"patch": "partial_update", "delete": "destroy"})
apply_coupon = CartViewSet.as_view({"post": "apply_coupon"})
checkout = CartViewSet.as_view({"post": "checkout"})

# Order views
order_detail = OrderViewSet.as_view({"get": "retrieve"})
upload_payment = OrderViewSet.as_view({"post": "upload_payment"})
cancel_order = OrderViewSet.as_view({"post": "cancel_order"})

urlpatterns = [
    path("", include(router.urls)),
    
    # Cart endpoints
    path("cart/", cart_list),
    path("cart/<int:pk>/", cart_item_update),
    path("cart/apply-coupon/", apply_coupon),
    path("cart/checkout/", checkout),
    
    # Order endpoints
    path("orders/<int:pk>/", order_detail),
    path("orders/<int:pk>/upload-payment/", upload_payment),
    path("orders/<int:pk>/cancel/", cancel_order),
    
    # Order history
    path("history/", MyOrdersView.as_view()),
    
    # Payment configuration
    path("payment-config/", PaymentConfigView.as_view()),
]