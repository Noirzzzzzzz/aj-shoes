# orders/admin.py - Complete updated version
from django.contrib import admin
from django.contrib.admin.models import LogEntry, CHANGE
from django.contrib.contenttypes.models import ContentType
from django.utils.html import format_html
from django.utils import timezone
from django.db.models import F
from django.db import transaction

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

# ---------- Order Admin Actions ----------

@admin.action(description="Approve payment (verify payment slip)")
def approve_payment(modeladmin, request, queryset):
    """Approve payment and move to payment_verified status"""
    to_update = queryset.filter(status="pending_payment", payment_slip__isnull=False)
    
    if not to_update.exists():
        modeladmin.message_user(
            request, 
            "No orders with payment slips found to approve.",
            level="warning"
        )
        return
    
    updated_orders = []
    for order in to_update:
        order.status = "payment_verified"
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
            change_message="Admin approved payment and verified payment slip.",
        )
    
    count = len(updated_orders)
    modeladmin.message_user(request, f"Approved payment for {count} order(s).")

@admin.action(description="Mark as shipped")
def mark_shipped(modeladmin, request, queryset):
    """Mark payment_verified orders as shipped"""
    to_update = queryset.filter(status="payment_verified")
    
    if not to_update.exists():
        modeladmin.message_user(
            request, 
            "No payment verified orders found to ship.",
            level="warning"
        )
        return
    
    updated_orders = []
    for order in to_update:
        order.status = "shipped"
        order.save()
        updated_orders.append(order)
        
        # Log the action
        LogEntry.objects.log_action(
            user_id=request.user.id,
            content_type_id=ContentType.objects.get_for_model(order).pk,
            object_id=str(order.pk),
            object_repr=f"Order #{order.pk}",
            action_flag=CHANGE,
            change_message="Admin marked order as shipped.",
        )
    
    count = len(updated_orders)
    modeladmin.message_user(request, f"Marked {count} order(s) as shipped.")

@admin.action(description="Mark as delivered")
def mark_delivered(modeladmin, request, queryset):
    """Mark shipped orders as delivered"""
    to_update = queryset.filter(status="shipped")
    
    if not to_update.exists():
        modeladmin.message_user(
            request, 
            "No shipped orders found to mark as delivered.",
            level="warning"
        )
        return
    
    count = to_update.update(status="delivered")
    modeladmin.message_user(request, f"Marked {count} order(s) as delivered.")

@admin.action(description="Reject payment and delete order")
def reject_payment(modeladmin, request, queryset):
    """Reject payment and delete order completely"""
    from .models import Cart, CartItem
    
    to_delete = queryset.filter(status="pending_payment")
    count = 0
    
    for order in to_delete:
        with transaction.atomic():
            # เก็บข้อมูล order items ก่อนลบ
            order_items_backup = []
            for order_item in order.items.all():
                order_items_backup.append({
                    'product_id': order_item.product_id,
                    'variant_id': order_item.variant_id,
                    'quantity': order_item.quantity
                })
            
            # คืน stock กลับ (ถ้าเคยลดไปแล้ว)
            if order.payment_slip:  # ถ้าเคยอัปโหลดสลิปแล้ว
                for order_item in order.items.all():
                    variant = order_item.variant
                    variant.stock = F("stock") + order_item.quantity
                    variant.save(update_fields=["stock"])
            
            # คืน coupon usage กลับ
            if order.coupon:
                order.coupon.uses_count = F("uses_count") - 1
                order.coupon.save(update_fields=["uses_count"])
            
            # คืนสินค้ากลับ cart
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
    
    modeladmin.message_user(
        request, 
        f"Deleted {count} order(s) completely. Items and stock restored to customers' carts."
    )

@admin.action(description="Clean up expired orders")
def cleanup_expired_orders(modeladmin, request, queryset):
    """Clean up expired pending payment orders"""
    from .models import Cart, CartItem
    
    expired_orders = Order.objects.filter(
        status="pending_payment",
        payment_deadline__lt=timezone.now()
    )
    
    count = 0
    for order in expired_orders:
        with transaction.atomic():
            # คืน stock (ถ้าเคยลดไปแล้ว)
            if order.payment_slip:
                for order_item in order.items.all():
                    variant = order_item.variant
                    variant.stock = F("stock") + order_item.quantity
                    variant.save(update_fields=["stock"])
            
            # เก็บข้อมูลเพื่อคืนเข้า cart
            order_items_backup = []
            for order_item in order.items.all():
                order_items_backup.append({
                    'product_id': order_item.product_id,
                    'variant_id': order_item.variant_id,
                    'quantity': order_item.quantity
                })
            
            # คืนสินค้ากลับ cart
            cart, _ = Cart.objects.get_or_create(user=order.user)
            for item_backup in order_items_backup:
                cart_item, created = CartItem.objects.get_or_create(
                    cart=cart,
                    product_id=item_backup['product_id'],
                    variant_id=item_backup['variant_id'],
                    defaults={"quantity": item_backup['quantity']}
                )
                if not created:
                    cart_item.quantity = F("quantity") + item_backup['quantity']
                    cart_item.save()
            
            # คืน coupon usage
            if order.coupon:
                order.coupon.uses_count = F("uses_count") - 1
                order.coupon.save(update_fields=["uses_count"])
            
            order.delete()
            count += 1
    
    modeladmin.message_user(request, f"Cleaned up {count} expired orders.")

# ---------- Order Admin with Inlines ----------

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product", "variant", "price", "quantity")

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user", "status", "total", "payment_deadline", 
        "payment_slip_preview", "shipping_carrier", "created_at", "payment_verified_at"
    )
    list_filter = ("status", "shipping_carrier", "created_at", "payment_verified_at")
    search_fields = ("id", "user__username", "user__email")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    readonly_fields = ("user", "created_at", "payment_deadline", "payment_slip_preview", "is_expired")
    inlines = [OrderItemInline]
    
    # Updated actions
    actions = [approve_payment, mark_shipped, mark_delivered, reject_payment, cleanup_expired_orders]

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
            return format_html('<span style="color: red;">⚠️ Expired</span>')
        elif obj.status == "pending_payment" and obj.payment_slip:
            return format_html('<span style="color: orange;">📋 Awaiting Approval</span>')
        elif obj.status == "payment_verified":
            return format_html('<span style="color: blue;">✅ Verified - Ready to Ship</span>')
        elif obj.status == "shipped":
            return format_html('<span style="color: green;">🚚 Shipped</span>')
        elif obj.status == "delivered":
            return format_html('<span style="color: green;">📦 Delivered</span>')
        return "⏳ Pending Payment"
    is_expired.short_description = "Status"

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

    def get_queryset(self, request):
        """Show more details in admin list"""
        return super().get_queryset(request).select_related('user', 'coupon', 'address')

    def has_change_permission(self, request, obj=None):
        """Restrict editing of certain fields"""
        return True

    def get_readonly_fields(self, request, obj=None):
        """Make some fields readonly after creation"""
        readonly = list(self.readonly_fields)
        if obj:  # editing an existing object
            readonly.extend(["user", "total", "shipping_cost"])
        return readonly