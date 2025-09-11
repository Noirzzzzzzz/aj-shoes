from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from aj_shoes_backend.observability_views import FrontendLogView
from aj_shoes_backend.image_opt import optimize_image
from django.conf import settings
from django.conf.urls.static import static



urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema")),

    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    path("api/accounts/", include("accounts.urls")),
    path("api/catalog/", include("catalog.urls")),
    path("api/coupons/", include("coupons.urls")),
    path("api/orders/", include("orders.urls")),
    path("api/chat/", include("chat.urls")),

    # NEW: Admin API
    path("api/admin/", include("aj_shoes_backend.urls_admin")),

    path("api/logs/frontend/", FrontendLogView.as_view()),
    path("opt-img/", optimize_image),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
