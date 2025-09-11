from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
from .models import Order

# ถ้ามีโมเดล Notification (เราใส่ไว้ให้ใน accounts/models.py ด้านล่าง)
try:
    from accounts.models import AdminNotification
    HAS_NOTIFICATION = True
except Exception:
    HAS_NOTIFICATION = False

@receiver(post_save, sender=Order)
def order_created_notify_admin(sender, instance: Order, created, **kwargs):
    if not created:
        return
    if instance.status != "pending":
        return
    if HAS_NOTIFICATION:
        AdminNotification.objects.create(
            level="info",
            message=f"New order pending approval: #{instance.pk} by {instance.user}",
            user=instance.user,
            related_content_type=ContentType.objects.get_for_model(Order),
            related_object_id=str(instance.pk),
        )
