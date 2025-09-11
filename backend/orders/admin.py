# orders/admin.py - รวม Payment Admin
from django.contrib import admin
from django.contrib.admin.models import LogEntry, CHANGE
from django.contrib.contenttypes.models import ContentType
from django.utils.html import format_html
from django.utils import timezone

from .models import (
    Address,
    Cart,
    CartItem,
    Order,
    OrderItem,
    Review,
    Favorite,
    PaymentMethod,  # เพิ่ม
    OrderPayment,   # เพิ่ม
)

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "display_address", "is_default")
    list_filter = ()
    search_fields = ("user__username", "user__email")
    ordering = ("id",)

    def display_address(self, obj):
        return str(obj)
    display_address.short_description = "Address"

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if obj.is_default:
            Address.objects.filter(user=obj.user).exclude(pk=obj.pk).update(is_default=False)

@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "created_at")
    search_fields = ("user__username", "user__email")
    ordering = ("-created_at",)

@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("id", "cart", "product", "variant", "quantity")
    search_fields = ("cart__user__username", "cart__user__email", "product__name")

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "product", "variant", "price", "quantity")
    search_fields = ("order__id", "product__name", "order__user__username", "order__user__email")

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "product", "rating", "created_at")
    search_fields = ("user__username", "product__name")
    list_filter = ("rating",)

@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "product", "created_at")
    search_fields = ("user__username", "product__name")

# ===== เพิ่ม Payment Admin =====
@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ("name", "bank_name", "account_name", "account_number", "is_active", "qr_preview")
    list_filter = ("is_active", "bank_name")
    search_fields = ("name", "bank_name", "account_name", "account_number")
    
    def qr_preview(self, obj):
        if obj.qr_code_image:
            return format_html(
                '<img src="{}" width="50" height="50" />',
                obj.qr_code_image.url
            )
        return "No image"
    qr_preview.short_description = "QR Preview"

@admin.action(description="Verify selected payments")
def verify_payments(modeladmin, request, queryset):
    updated = queryset.filter(status="uploaded").update(
        status="verified",
        verified_by=request.user,
        verified_at=timezone.now()
    )
    modeladmin.message_user(request, f"Verified {updated} payment(s).")

@admin.action(description="Reject selected payments")
def reject_payments(modeladmin, request, queryset):
    updated = queryset.filter(status="uploaded").update(
        status="rejected",
        verified_by=request.user,
        verified_at=timezone.now()
    )
    modeladmin.message_user(request, f"Rejected {updated} payment(s).")

@admin.register(OrderPayment)
class OrderPaymentAdmin(admin.ModelAdmin):
    list_display = ("order_id", "order_user", "total_amount", "status", "payment_slip_preview", "uploaded_at", "is_expired_display")
    list_filter = ("status", "payment_method", "created_at", "uploaded_at")
    search_fields = ("order__id", "order__user__username", "order__user__email")
    readonly_fields = ("order", "total_amount", "created_at", "updated_at", "uploaded_at")
    actions = [verify_payments, reject_payments]
    
    def order_id(self, obj):
        return f"#{obj.order.id}"
    order_id.short_description = "Order"
    
    def order_user(self, obj):
        return obj.order.user.username
    order_user.short_description = "Customer"
    
    def payment_slip_preview(self, obj):
        if obj.payment_slip:
            return format_html(
                '<a href="{}" target="_blank"><img src="{}" width="50" height="50" /></a>',
                obj.payment_slip.url, obj.payment_slip.url
            )
        return "No slip uploaded"
    payment_slip_preview.short_description = "Payment Slip"
    
    def is_expired_display(self, obj):
        if obj.is_expired():
            return format_html('<span style="color: red;">Expired</span>')
        return "Active"
    is_expired_display.short_description = "Status"

# ---------- Orders พร้อม Action Approve / Delivered ----------
class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product", "variant", "price", "quantity")

@admin.action(description="Approve (mark as shipped)")
def approve_orders(modeladmin, request, queryset):
    to_update = queryset.filter(status="pending")
    count = to_update.update(status="shipped")
    for order in to_update:
        LogEntry.objects.log_action(
            user_id=request.user.id,
            content_type_id=ContentType.objects.get_for_model(order).pk,
            object_id=str(order.pk),
            object_repr=f"Order #{order.pk}",
            action_flag=CHANGE,
            change_message="Admin approved order (marked as shipped).",
        )
    modeladmin.message_user(request, f"Approved {count} order(s).")

@admin.action(description="Mark as delivered")
def mark_delivered(modeladmin, request, queryset):
    to_update = queryset.exclude(status="delivered")
    count = to_update.update(status="delivered")
    modeladmin.message_user(request, f"Marked delivered: {count} order(s).")

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "status", "shipping_carrier", "shipping_cost", "total", "payment_status", "created_at")
    list_filter = ("status", "shipping_carrier", "created_at")
    search_fields = ("id", "user__username", "user__email")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    readonly_fields = ("user", "created_at")
    inlines = [OrderItemInline]
    actions = [approve_orders, mark_delivered]
    
    def payment_status(self, obj):
        try:
            payment = obj.payment
            color = {
                'pending': 'orange',
                'uploaded': 'blue', 
                'verified': 'green',
                'rejected': 'red'
            }.get(payment.status, 'gray')
            return format_html(
                '<span style="color: {};">{}</span>',
                color, payment.get_status_display()
            )
        except:
            return "No payment"
    payment_status.short_description = "Payment"