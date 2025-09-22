from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

from .serializers import RegisterSerializer, UserSerializer
from .models import SecurityQuestion

from django.contrib.admin.models import LogEntry, CHANGE
from django.contrib.contenttypes.models import ContentType

from orders.models import Address

User = get_user_model()

try:
    from .models import AdminNotification
    HAS_NOTIFICATION = True
except Exception:
    HAS_NOTIFICATION = False


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def perform_update(self, serializer):
        user = serializer.save()

        LogEntry.objects.log_action(
            user_id=self.request.user.id,
            content_type_id=ContentType.objects.get_for_model(User).pk,
            object_id=str(user.pk),
            object_repr=user.get_username(),
            action_flag=CHANGE,
            change_message="User updated own profile via customer portal.",
        )

        if HAS_NOTIFICATION:
            AdminNotification.objects.create(
                level="info",
                message="Profile updated by customer.",
                user=self.request.user,
                related_content_type=ContentType.objects.get_for_model(User),
                related_object_id=str(user.pk),
            )

        addr_text = serializer.validated_data.get("default_address", None)
        phone_text = serializer.validated_data.get("phone", None) or getattr(user, "phone", "")
        full_name = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip() or user.get_username()

        if addr_text is not None:
            addr, created = Address.objects.get_or_create(
                user=user,
                is_default=True,
                defaults={
                    "full_name": full_name,
                    "phone": phone_text or "",
                    "address": addr_text or "",
                    "province": "",
                    "postal_code": "",
                },
            )
            if not created:
                addr.full_name = full_name
                if phone_text is not None:
                    addr.phone = phone_text
                addr.address = addr_text or ""
                addr.save()


# -------------------------------
# Security Q/A & Password flows
# -------------------------------
class SecurityQuestionListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return SecurityQuestion.objects.filter(is_active=True).order_by("id")

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset().values("id", "question")
        return Response(list(qs), status=200)


class SetSecurityAnswerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        question_id = request.data.get("security_question")
        answer = (request.data.get("security_answer") or "").strip()

        if not question_id:
            return Response({"detail": "security_question is required"}, status=400)
        if not answer:
            return Response({"detail": "security_answer is required"}, status=400)

        try:
            q = SecurityQuestion.objects.get(id=question_id, is_active=True)
        except SecurityQuestion.DoesNotExist:
            return Response({"detail": "Invalid or inactive question"}, status=404)

        ser = UserSerializer(
            request.user,
            data={"security_question": q.id, "security_answer": answer},
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response({"detail": "Security question & answer updated"}, status=200)


class ForgotPasswordView(APIView):
    """
    ตรวจคำตอบเป็น plain text (ตรงตัว)
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get("username")
        qid = request.data.get("security_question")
        answer = (request.data.get("answer") or "").strip()
        new_password = request.data.get("new_password")

        if not all([username, qid, answer, new_password]):
            return Response({"detail": "username, security_question, answer, new_password are required"}, status=400)

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=404)

        if not user.security_question_id:
            return Response({"detail": "User has no security question set"}, status=400)

        try:
            if int(qid) != int(user.security_question_id):
                return Response({"detail": "Security question mismatch"}, status=400)
        except Exception:
            return Response({"detail": "Invalid security_question"}, status=400)

        if not user.security_answer:
            return Response({"detail": "No security answer found for this user"}, status=400)

        # ✅ เทียบข้อความตรง ๆ
        if answer != user.security_answer:
            return Response({"detail": "Security answer incorrect"}, status=400)

        try:
            validate_password(new_password, user=user)
        except Exception as e:
            return Response({"detail": list(e.messages)}, status=400)

        user.set_password(new_password)
        user.save()

        try:
            if HAS_NOTIFICATION:
                AdminNotification.objects.create(
                    level="warning",
                    message=f"Password reset via security question for user {user.username}",
                    user=user,
                    related_content_type=ContentType.objects.get_for_model(User),
                    related_object_id=str(user.pk),
                )
        except Exception:
            pass

        return Response({"detail": "Password reset successful"}, status=200)



class ChangePasswordView(APIView):
    """
    POST /api/accounts/change-password/
    body:
      - security_question: <id ที่ผู้ใช้ตั้งไว้>
      - answer: <คำตอบ (plain text)>
      - new_password1: <รหัสใหม่>
      - new_password2: <รหัสใหม่ยืนยัน>
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        qid = request.data.get("security_question")
        answer = (request.data.get("answer") or "").strip()
        p1 = request.data.get("new_password1")
        p2 = request.data.get("new_password2")

        if not all([qid, answer, p1, p2]):
            return Response({"detail": "security_question, answer, new_password1, new_password2 are required"}, status=400)

        user = request.user

        # ต้องเคยตั้งคำถามไว้ก่อน
        if not user.security_question_id:
            return Response({"detail": "No security question set for this user"}, status=400)

        # id คำถามต้องตรงกับที่ตั้งไว้
        try:
            if int(qid) != int(user.security_question_id):
                return Response({"detail": "Security question mismatch"}, status=400)
        except Exception:
            return Response({"detail": "Invalid security_question"}, status=400)

        # ✅ เทียบคำตอบแบบ plain text
        if (user.security_answer or "").strip() == "":
            return Response({"detail": "No security answer found"}, status=400)
        if answer != user.security_answer:
            return Response({"detail": "Security answer incorrect"}, status=400)

        # รหัสใหม่สองช่องต้องตรงกัน
        if p1 != p2:
            return Response({"detail": "Passwords do not match"}, status=400)

        # ตรวจตาม password validators
        try:
            validate_password(p1, user=user)
        except Exception as e:
            return Response({"detail": list(e.messages)}, status=400)

        user.set_password(p1)
        user.save()
        return Response({"detail": "Password changed successfully"}, status=200)