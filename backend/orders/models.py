# orders/models.py
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

# New Payment Configuration Model
class PaymentConfig(models.Model):
    bank_name = models.CharField(max_length=100, default="PromptPay")
    account_name = models.CharField(max_length=200, default="AJ Shoes Store")
    account_number = models.CharField(max_length=50, default="0912345678")
    qr_code_image = models.ImageField(upload_to='payment_qr/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.bank_name} - {self.account_name}"

class Order(models.Model):
    class Status(models.TextChoices):
        PENDING_PAYMENT = "pending_payment", "Pending Payment"
        PENDING = "pending", "Pending"
        SHIPPED = "shipped", "Shipped"
        DELIVERED = "delivered", "Delivered"
        # ลบ CANCELLED ออกเลย

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="orders")
    address = models.ForeignKey(Address, on_delete=models.PROTECT)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING_PAYMENT)
    shipping_carrier = models.CharField(max_length=32, default="Kerry")
    shipping_cost = models.DecimalField(max_digits=10, decimal_places=2, default=50)
    coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_deadline = models.DateTimeField(null=True, blank=True)
    payment_slip = models.ImageField(upload_to='payment_slips/', null=True, blank=True)
    payment_verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.payment_deadline and self.status == self.Status.PENDING_PAYMENT:
            self.payment_deadline = timezone.now() + timedelta(minutes=30)
        super().save(*args, **kwargs)

    @property
    def is_payment_expired(self):
        if not self.payment_deadline:
            return False
        return timezone.now() > self.payment_deadline

    def __str__(self):
        return f"Order #{self.id} - {self.user.username}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    variant = models.ForeignKey(Variant, on_delete=models.PROTECT)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quantity = models.PositiveIntegerField(default=1)

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