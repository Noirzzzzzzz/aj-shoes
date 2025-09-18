from django.urls import path
from . import views

urlpatterns = [
    path("my-room/", views.get_or_create_room, name="get_or_create_room"),
    path("rooms/", views.list_rooms, name="list_rooms"),
    path("rooms/<int:room_id>/messages/", views.get_room_messages, name="get_room_messages"),
    path("rooms/<int:room_id>/send/", views.send_message, name="send_message"),  # ✅ ใหม่
]
