# notifications/urls.py
from django.urls import path
from .views import NotificationListView, mark_read, mark_all_read, NotificationPreferenceView, WebPushSubscribeView

urlpatterns = [
    path("", NotificationListView.as_view(), name="notification-list"),
    path("mark-read/", mark_read, name="notification-mark-read"),
    path("mark-all-read/", mark_all_read, name="notification-mark-all-read"),
    path("prefs/", NotificationPreferenceView.as_view(), name="notification-prefs"),
    path("push/subscribe/", WebPushSubscribeView.as_view(), name="push-subscribe"),
]
