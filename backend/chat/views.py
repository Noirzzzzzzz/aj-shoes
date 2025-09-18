from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import ChatRoom, ChatMessage
from .serializers import ChatRoomSerializer, ChatMessageSerializer
from PIL import Image

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_or_create_room(request):
    """ลูกค้า: ดึงห้องแชทของตัวเอง (สร้างใหม่ถ้าไม่มี)"""
    user = request.user
    
    if user.role in ['superadmin', 'subadmin']:
        return Response({'error': 'Admins cannot have personal chat rooms'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    room, created = ChatRoom.objects.get_or_create(customer=user)
    
    # ดึงข้อความล่าสุด 50 ข้อความ
    messages = room.messages.all().order_by('-timestamp')[:50]
    messages = list(reversed(messages))  # เรียงใหม่เป็น timestamp เก่า -> ใหม่
    
    return Response({
        'room': ChatRoomSerializer(room).data,
        'messages': ChatMessageSerializer(messages, many=True).data
    })

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_rooms(request):
    """Admin: ดึงรายการห้องแชททั้งหมด"""
    user = request.user
    
    if user.role not in ['superadmin', 'subadmin']:
        return Response({'error': 'Permission denied'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    rooms = ChatRoom.objects.all()
    return Response(ChatRoomSerializer(rooms, many=True).data)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_room_messages(request, room_id):
    """ดึงข้อความในห้องแชท"""
    user = request.user
    room = get_object_or_404(ChatRoom, id=room_id)
    
    # ตรวจสอบสิทธิ์
    if user.role not in ['superadmin', 'subadmin'] and room.customer != user:
        return Response({'error': 'Permission denied'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    messages = room.messages.all().order_by('timestamp')
    return Response(ChatMessageSerializer(messages, many=True).data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def send_message(request, room_id):
    """ส่งข้อความ"""
    user = request.user
    room = get_object_or_404(ChatRoom, id=room_id)
    
    # ตรวจสอบสิทธิ์
    if user.role not in ['superadmin', 'subadmin'] and room.customer != user:
        return Response({'error': 'Permission denied'}, 
                       status=status.HTTP_403_FORBIDDEN)
    
    message_text = request.data.get('message', '').strip()
    image = request.FILES.get('image')
    
    if not message_text and not image:
        return Response({'error': 'Message cannot be empty'}, 
                       status=status.HTTP_400_BAD_REQUEST)
    
    # สร้างข้อความ
    message = ChatMessage.objects.create(
        room=room,
        sender=user,
        message=message_text,
        image=image
    )
    
    # อัปเดต updated_at ของห้อง
    room.save()
    
    return Response(ChatMessageSerializer(message).data, 
                   status=status.HTTP_201_CREATED)

MAX_MSG_LEN = 2000
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def send_message(request, room_id):
    user = request.user
    room = get_object_or_404(ChatRoom, id=room_id)

    if user.role not in ['superadmin', 'subadmin'] and room.customer != user:
        return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

    message_text = (request.data.get('message') or '').strip()
    if len(message_text) > MAX_MSG_LEN:
        return Response({'error': 'Message too long'}, status=status.HTTP_400_BAD_REQUEST)

    image = request.FILES.get('image')

    if not message_text and not image:
        return Response({'error': 'Message cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)

    # ✅ validate image (optional field)
    if image:
        if getattr(image, "size", 0) > MAX_IMAGE_BYTES:
            return Response({'error': 'Image too large (max 5MB)'}, status=status.HTTP_400_BAD_REQUEST)

        # content-type header
        ctype = (getattr(image, "content_type", "") or "").lower()
        if ctype not in ALLOWED_MIME:
            return Response({'error': 'Unsupported image type'}, status=status.HTTP_400_BAD_REQUEST)

        # verify real image (avoid disguised files)
        try:
            pos = image.tell()
            img = Image.open(image)
            img.verify()
            image.seek(pos)
        except Exception:
            return Response({'error': 'Invalid image file'}, status=status.HTTP_400_BAD_REQUEST)

    message = ChatMessage.objects.create(room=room, sender=user, message=message_text, image=image)
    room.save(update_fields=["updated_at"])

    return Response(ChatMessageSerializer(message).data, status=status.HTTP_201_CREATED)
