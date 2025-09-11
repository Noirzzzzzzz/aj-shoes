from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import ChatThreadViewSet

router = DefaultRouter()
router.register(r"threads", ChatThreadViewSet, basename="chat-thread")

urlpatterns = [
    path("", include(router.urls)),
]
