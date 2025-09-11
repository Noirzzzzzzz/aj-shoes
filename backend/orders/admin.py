# orders/admin.py
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
    PaymentConfig,
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

# New Payment Configuration Admin
@admin.register(PaymentConfig)
class PaymentConfigAdmin(admin.ModelAdmin):
    list_display = ("bank_name", "account_name", "account_number", "is_active", "created_at")
    list_filter = ("is_active", "bank_name")
    readonly_fields = ("qr_preview",)
    fields = ("bank_name", "account_name", "account_number", "qr_code_image", "qr_preview", "is_active")

    def qr_preview(self, obj):
        if obj.qr_code_image:
            return format_html(
                '<img src="{}" style="max-width: 200px; max-height: 200px;" />',
                obj.qr_code_image.url
            )
        return "No QR code uploaded"
    qr_preview.short_description = "QR Code Preview"

# ---------- Orders with Payment Management ----------
class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product", "variant", "price", "quantity")

@admin.action(description="Approve payment and mark as shipped")
def approve_payment_and_ship(modeladmin, request, queryset):
    """Approve payment and move to shipped status"""
    to_update = queryset.filter(status="pending_payment")
    updated_orders = []
    
    for order in to_update:
        order.status = "shipped"
        order.payment_verified_at = timezone.now()
        order.save()
        updated_orders.append(order)
        
        # Log the action
        LogEntry.objects.log_action(
            user_id=request.user.id,
            content_type_id=ContentType.objects.get_for_model(order).pk,
            object_id=str(order.pk),
            object_repr=f"Order #{order.pk}",
            action_flag=CHANGE,
            change_message="Admin approved payment and marked as shipped.",
        )
    
    count = len(updated_orders)
    modeladmin.message_user(request, f"Approved payment and shipped {count} order(s).")

@admin.action(description="Reject payment and delete order")
def reject_payment(modeladmin, request, queryset):
    """Reject payment and delete order completely - will not appear in order history"""
    from .models import Cart, CartItem
    
    to_delete = queryset.filter(status="pending_payment")
    count = 0
    
    for order in to_delete:
        # เก็บข้อมูล order items ก่อนลบ
        order_items_backup = []
        for order_item in order.items.all():
            order_items_backup.append({
                'product_id': order_item.product_id,
                'variant_id': order_item.variant_id,
                'quantity': order_item.quantity
            })
        
        # คืนสินค้ากลับ cart ด้วยจำนวนเดิม
        cart, _ = Cart.objects.get_or_create(user=order.user)
        for item_backup in order_items_backup:
            # ลบ cart item เดิมก่อน (ถ้ามี)
            CartItem.objects.filter(
                cart=cart,
                product_id=item_backup['product_id'],
                variant_id=item_backup['variant_id']
            ).delete()
            
            # สร้าง cart item ใหม่ด้วยจำนวนเดิม
            CartItem.objects.create(
                cart=cart,
                product_id=item_backup['product_id'],
                variant_id=item_backup['variant_id'],
                quantity=item_backup['quantity']
            )
        
        # ลบ order ออกจากฐานข้อมูลทั้งหมด
        order.delete()
        count += 1
    
    modeladmin.message_user(request, f"Deleted {count} order(s) completely. Items restored to customers' carts.")

@admin.action(description="Mark as delivered")
def mark_delivered(modeladmin, request, queryset):
    to_update = queryset.exclude(status="delivered")
    count = to_update.update(status="delivered")
    modeladmin.message_user(request, f"Marked delivered: {count} order(s).")

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user", "status", "total", "payment_deadline", 
        "payment_slip_preview", "shipping_carrier", "created_at"
    )
    list_filter = ("status", "shipping_carrier", "created_at", "payment_verified_at")
    search_fields = ("id", "user__username", "user__email")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    readonly_fields = ("user", "created_at", "payment_deadline", "payment_slip_preview", "is_expired")
    inlines = [OrderItemInline]
    actions = [approve_payment_and_ship, reject_payment, mark_delivered]

    def payment_slip_preview(self, obj):
        if obj.payment_slip:
            return format_html(
                '<a href="{}" target="_blank"><img src="{}" style="max-width: 100px; max-height: 100px;" /></a>',
                obj.payment_slip.url,
                obj.payment_slip.url
            )
        return "No payment slip"
    payment_slip_preview.short_description = "Payment Slip"

    def is_expired(self, obj):
        if obj.is_payment_expired and obj.status == "pending_payment":
            return format_html('<span style="color: red;">Expired</span>')
        return "Active"
    is_expired.short_description = "Payment Status"

    fieldsets = (
        ("Order Information", {
            "fields": ("user", "status", "total", "created_at")
        }),
        ("Shipping", {
            "fields": ("address", "shipping_carrier", "shipping_cost")
        }),
        ("Payment", {
            "fields": ("payment_deadline", "is_expired", "payment_slip", "payment_slip_preview", "payment_verified_at")
        }),
        ("Discount", {
            "fields": ("coupon",)
        }),
    )