# orders/models.py - เพิ่ม Payment models
from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from catalog.models import Product, Variant
from coupons.models import Coupon

User = settings.AUTH_USER_MODEL

class Address(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="addresses")
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=32)
    address = models.TextField()
    province = models.CharField(max_length=120, blank=True, default="")
    postal_code = models.CharField(max_length=16, blank=True, default="")
    is_default = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.full_name} ({self.postal_code})"

class Cart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="cart")
    coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    variant = models.ForeignKey(Variant, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)

# ===== เพิ่มส่วน Payment Models =====
class PaymentMethod(models.Model):
    """ข้อมูล QR Code ที่แอดมินอัปโหลด"""
    name = models.CharField(max_length=100)
    bank_name = models.CharField(max_length=100)
    account_name = models.CharField(max_length=200)
    account_number = models.CharField(max_length=50)
    qr_code_image = models.ImageField(upload_to='payment_qr/')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.bank_name}"

class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SHIPPED = "shipped", "Shipped"
        DELIVERED = "delivered", "Delivered"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="orders")
    address = models.ForeignKey(Address, on_delete=models.PROTECT)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    shipping_carrier = models.CharField(max_length=32, default="Kerry")
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=50)
    coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    variant = models.ForeignKey(Variant, on_delete=models.PROTECT)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quantity = models.PositiveIntegerField(default=1)

class OrderPayment(models.Model):
    """การชำระเงิน"""
    class Status(models.TextChoices):
        PENDING = "pending", "Pending Payment"
        UPLOADED = "uploaded", "Slip Uploaded"
        VERIFIED = "verified", "Payment Verified"
        REJECTED = "rejected", "Payment Rejected"

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='payment')
    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.PROTECT)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    
    # Payment slip upload
    payment_slip = models.ImageField(upload_to='payment_slips/', null=True, blank=True)
    uploaded_at = models.DateTimeField(null=True, blank=True)
    
    # Admin verification
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_payments')
    verified_at = models.DateTimeField(null=True, blank=True)
    admin_note = models.TextField(blank=True, default="")
    
    # Expiry
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Payment for Order #{self.order.id} - {self.get_status_display()}"

class Favorite(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="favorites")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "product")
        ordering = ("-created_at",)

class Review(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveIntegerField(default=5)
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

class PendingCheckout(models.Model):
    """เก็บข้อมูล checkout ชั่วคราวแทน session"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="pending_checkouts")
    temp_payment_id = models.CharField(max_length=100, unique=True)
    address = models.ForeignKey(Address, on_delete=models.CASCADE)
    carrier = models.CharField(max_length=32, default="Kerry")
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=50)
    coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    cart_item_ids = models.JSONField()  # เก็บ list ของ cart item ids
    
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Pending checkout {self.temp_payment_id} by {self.user.username}"