from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
from django.contrib.contenttypes.models import ContentType

class SecurityQuestion(models.Model):
    """
    คำถามเพื่อยืนยันตัวตนตอนรีเซ็ตรหัสผ่าน
    แอดมินเป็นผู้เพิ่ม/เปิด-ปิดการใช้งาน
    """
    question = models.CharField(max_length=255, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.question


class User(AbstractUser):
    class Roles(models.TextChoices):
        SUPERADMIN = "superadmin", "Superadmin"
        SUBADMIN = "subadmin", "Sub-admin"
        CUSTOMER = "customer", "Customer"

    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.CUSTOMER)

    phone = models.CharField(max_length=32, blank=True)
    default_address = models.TextField(blank=True)

    # ✅ ผูกคำถาม + เก็บคำตอบ (แฮช)
    security_question = models.ForeignKey(
        SecurityQuestion, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="users"
    )
    security_answer = models.CharField(
        max_length=255, blank=True,
        help_text="เก็บเป็น plain text"  # ← เดิมระบุว่า hash
    )

    def is_superadmin(self):
        return self.role == self.Roles.SUPERADMIN

    def is_subadmin(self):
        return self.role == self.Roles.SUBADMIN


class AdminNotification(models.Model):
    LEVEL_CHOICES = (
        ("info", "Info"),
        ("warning", "Warning"),
        ("success", "Success"),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default="info")
    message = models.TextField()
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    related_content_type = models.ForeignKey(ContentType, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    related_object_id = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.level}] {self.message[:60]}"
