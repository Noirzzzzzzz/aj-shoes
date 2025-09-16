from rest_framework.routers import DefaultRouter
from .views import CouponViewSet

router = DefaultRouter()
# ✅ ลงทะเบียนที่รากของ prefix นี้ (ว่างเปล่า) เพื่อให้ path เป็น /api/coupons/...
router.register(r"", CouponViewSet, basename="coupons")

urlpatterns = router.urls