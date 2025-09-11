# orders/views.py - Complete file with session-based checkout
from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.files.base import ContentFile
import base64

from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Address, Cart, CartItem, Order, OrderItem, Favorite, Review, PaymentMethod, OrderPayment
from .serializers import (
    AddressSerializer,
    CartSerializer,
    CartItemSerializer,
    OrderSerializer,
    FavoriteSerializer,
    ReviewSerializer,
    PaymentInfoSerializer,
    PaymentSlipUploadSerializer,
)

User = get_user_model()


def _ensure_cart(user):
    cart, _ = Cart.objects.get_or_create(user=user)
    return cart


def _ensure_payment_method():
    """สร้าง PaymentMethod ตัวอย่างถ้ายังไม่มี"""
    payment_method = PaymentMethod.objects.filter(is_active=True).first()
    
    if not payment_method:
        # สร้างรูป QR ตัวอย่าง (1x1 pixel PNG)
        sample_qr_data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9yF7aYAAAAASUVORK5CYII="
        qr_content = ContentFile(base64.b64decode(sample_qr_data), name="default_qr.png")
        
        payment_method = PaymentMethod.objects.create(
            name="PromptPay QR Code",
            bank_name="PromptPay",
            account_name="AJ Shoes Store",
            account_number="0912345678",
            qr_code_image=qr_content,
            is_active=True
        )
    
    return payment_method


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CartViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    # GET /api/orders/cart/
    def list(self, request):
        cart = _ensure_cart(request.user)
        return Response(CartSerializer(cart, context={'request': request}).data)

    # POST /api/orders/cart/
    def create(self, request):
        cart = _ensure_cart(request.user)
        serializer = CartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product = serializer.validated_data["product"]
        variant = serializer.validated_data["variant"]
        qty = serializer.validated_data["quantity"]

        item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            variant=variant,
            defaults={"quantity": qty},
        )
        if not created:
            item.quantity = F("quantity") + qty
            item.save()
            item.refresh_from_db()

        return Response(CartItemSerializer(item).data, status=status.HTTP_201_CREATED)

    # PATCH /api/orders/cart/<pk>/
    def partial_update(self, request, pk=None):
        cart = _ensure_cart(request.user)
        item = get_object_or_404(CartItem, pk=pk, cart=cart)
        qty = int(request.data.get("quantity", 1))
        if qty < 1:
            qty = 1
        item.quantity = qty
        item.save()
        return Response(CartItemSerializer(item).data)

    # DELETE /api/orders/cart/<pk>/
    def destroy(self, request, pk=None):
        cart = _ensure_cart(request.user)
        item = get_object_or_404(CartItem, pk=pk, cart=cart)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # POST /api/orders/cart/apply-coupon/
    @action(detail=False, methods=["post"])
    def apply_coupon(self, request):
        cart = _ensure_cart(request.user)
        serializer = CartSerializer(
            cart, data={"coupon_code": request.data.get("code", "")}, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CartSerializer(cart, context={'request': request}).data)

    # POST /api/orders/cart/checkout/ - Create payment info only, no Order yet
    @action(detail=False, methods=["post"])
    def checkout(self, request):
        cart = _ensure_cart(request.user)

        # --- validate address ---
        address_id = request.data.get("address_id")
        if not address_id:
            return Response({"detail": "address_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        address = get_object_or_404(Address, id=address_id, user=request.user)

        # --- รับ cart_item_ids ---
        item_ids = request.data.get("cart_item_ids", [])
        if item_ids in ("", None):
            item_ids = []
        if not isinstance(item_ids, (list, tuple)):
            return Response(
                {"detail": "cart_item_ids must be a list of integers"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            item_ids = [int(x) for x in item_ids]
        except (TypeError, ValueError):
            return Response(
                {"detail": "cart_item_ids must be a list of integers"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = cart.items.select_related("product", "variant")
        if item_ids:
            qs = qs.filter(id__in=item_ids)

        if not qs.exists():
            return Response({"detail": "No items selected."}, status=status.HTTP_400_BAD_REQUEST)

        # ตรวจสอบสต็อก
        for it in qs:
            if it.variant.stock < it.quantity:
                return Response({
                    "detail": f"Insufficient stock for {it.product.name_en} (variant {it.variant.id})."
                }, status=status.HTTP_400_BAD_REQUEST)

        # คำนวณราคา
        total = 0.0
        shipping_cost = 50.0
        
        for it in qs:
            price = float(it.product.sale_price)
            total += price * it.quantity

        # คูปอง
        if cart.coupon:
            c = cart.coupon
            if c.discount_type == "percent":
                if total >= float(c.min_spend):
                    total = total * (100 - c.percent_off) / 100
            elif c.discount_type == "free_shipping":
                if total >= float(c.min_spend):
                    shipping_cost = 0

        final_total = round(total + shipping_cost, 2)

        # ตรวจสอบและสร้าง PaymentMethod
        try:
            payment_method = _ensure_payment_method()
        except Exception as e:
            return Response({
                "detail": f"Failed to setup payment method: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # สร้างข้อมูล payment_info โดยไม่สร้าง Order
        # เก็บข้อมูลใน session
        request.session['pending_checkout'] = {
            'user_id': request.user.id,
            'address_id': address.id,
            'carrier': request.data.get("carrier", "Kerry"),
            'shipping_cost': shipping_cost,
            'coupon_id': cart.coupon.id if cart.coupon else None,
            'total': final_total,
            'cart_item_ids': item_ids,
            'created_at': timezone.now().isoformat(),
            'expires_at': (timezone.now() + timezone.timedelta(hours=24)).isoformat()
        }

        # สร้าง temporary ID สำหรับ payment
        temp_payment_id = f"temp_{request.user.id}_{int(timezone.now().timestamp())}"

        payment_info = {
            "id": temp_payment_id,
            "total_amount": final_total,
            "expires_at": (timezone.now() + timezone.timedelta(hours=24)).isoformat(),
            "qr_code_image": request.build_absolute_uri(payment_method.qr_code_image.url) if payment_method.qr_code_image else None,
            "bank_name": payment_method.bank_name,
            "account_name": payment_method.account_name,
            "account_number": payment_method.account_number,
        }
        
        return Response({
            "pending_checkout": True,
            "payment_info": payment_info,
            "cart_item_ids": item_ids
        }, status=status.HTTP_201_CREATED)

    # POST /api/orders/upload-payment-slip/ - Create Order after slip upload
    @action(detail=False, methods=["post"])
    def upload_payment_slip(self, request):
        import logging
        logger = logging.getLogger(__name__)
        
        temp_payment_id = request.data.get('order_id')
        slip_file = request.FILES.get('slip')
        
        logger.info(f"Upload payment slip called - User: {request.user.id}, temp_id: {temp_payment_id}, file: {slip_file.name if slip_file else 'None'}")
        
        if not temp_payment_id or not slip_file:
            logger.error("Missing order_id or slip file")
            return Response({"detail": "order_id and slip are required."}, status=status.HTTP_400_BAD_REQUEST)
        
        # ตรวจสอบ session data
        pending_checkout = request.session.get('pending_checkout')
        logger.info(f"Session data: {pending_checkout}")
        
        if not pending_checkout:
            logger.error("No pending checkout in session")
            return Response({"detail": "No pending checkout found. Please try checkout again."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # ง่ายขึ้น - ไม่เช็ค expiry ก่อน
            logger.info("Creating order...")
            
            payment_method = _ensure_payment_method()
            logger.info(f"Payment method: {payment_method}")
            
            with transaction.atomic():
                # สร้าง Order จริงตอนนี้
                cart = _ensure_cart(request.user)
                logger.info(f"Cart: {cart.id}")
                
                # ตรวจสอบ address
                address_id = pending_checkout.get('address_id')
                logger.info(f"Looking for address: {address_id}")
                
                try:
                    address = Address.objects.get(id=address_id, user=request.user)
                    logger.info(f"Address found: {address}")
                except Address.DoesNotExist:
                    logger.error(f"Address {address_id} not found")
                    return Response({"detail": "Selected address no longer exists."}, status=status.HTTP_400_BAD_REQUEST)
                
                # สร้าง Order
                order_data = {
                    'user': request.user,
                    'address': address,
                    'shipping_carrier': pending_checkout.get('carrier', 'Kerry'),
                    'shipping_cost': pending_checkout.get('shipping_cost', 50),
                    'total': pending_checkout.get('total', 0),
                }
                
                # เช็ค coupon
                coupon_id = pending_checkout.get('coupon_id')
                if coupon_id:
                    try:
                        from coupons.models import Coupon
                        coupon = Coupon.objects.get(id=coupon_id)
                        order_data['coupon'] = coupon
                        logger.info(f"Coupon found: {coupon}")
                    except Coupon.DoesNotExist:
                        logger.warning(f"Coupon {coupon_id} not found, proceeding without")
                
                logger.info(f"Creating order with data: {order_data}")
                order = Order.objects.create(**order_data)
                logger.info(f"Order created: {order.id}")

                # สร้าง OrderItems
                cart_item_ids = pending_checkout.get('cart_item_ids', [])
                logger.info(f"Looking for cart items: {cart_item_ids}")
                
                cart_items = CartItem.objects.filter(
                    cart=cart, 
                    id__in=cart_item_ids
                ).select_related("product", "variant")
                
                logger.info(f"Found cart items: {cart_items.count()}")
                
                if not cart_items.exists():
                    logger.error("No cart items found")
                    return Response({"detail": "Cart items no longer exist."}, status=status.HTTP_400_BAD_REQUEST)
                
                for it in cart_items:
                    logger.info(f"Processing item: {it.product.name_en}, stock: {it.variant.stock}, qty: {it.quantity}")
                    
                    # เช็คสต็อก
                    if it.variant.stock < it.quantity:
                        logger.error(f"Insufficient stock for {it.product.name_en}")
                        raise ValidationError(f"Insufficient stock for {it.product.name_en}")

                    price = float(it.product.sale_price)
                    order_item = OrderItem.objects.create(
                        order=order,
                        product=it.product,
                        variant=it.variant,
                        price=price,
                        quantity=it.quantity,
                    )
                    logger.info(f"OrderItem created: {order_item.id}")

                    # ตัดสต็อก
                    it.variant.stock = F("stock") - it.quantity
                    it.variant.save(update_fields=["stock"])
                    logger.info(f"Stock updated for variant {it.variant.id}")

                # สร้าง Payment
                payment = OrderPayment.objects.create(
                    order=order,
                    payment_method=payment_method,
                    total_amount=pending_checkout.get('total', 0),
                    status='uploaded',
                    payment_slip=slip_file,
                    uploaded_at=timezone.now(),
                    expires_at=timezone.now() + timezone.timedelta(hours=24)
                )
                logger.info(f"Payment created: {payment.id}")

                # อัปเดต coupon usage
                if coupon_id:
                    try:
                        from coupons.models import Coupon
                        coupon = Coupon.objects.get(id=coupon_id)
                        coupon.uses_count = F("uses_count") + 1
                        coupon.save(update_fields=["uses_count"])
                        logger.info(f"Coupon usage updated: {coupon.code}")
                    except Coupon.DoesNotExist:
                        logger.warning(f"Coupon {coupon_id} not found for usage update")

                # ลบ cart items
                deleted_count = cart_items.count()
                cart_items.delete()
                logger.info(f"Deleted {deleted_count} cart items")
                
                # ล้าง coupon ถ้าไม่เหลือ items
                if not cart.items.exists():
                    cart.coupon = None
                    cart.save(update_fields=["coupon"])
                    logger.info("Cart coupon cleared")

                # ลบ session data
                if 'pending_checkout' in request.session:
                    del request.session['pending_checkout']
                    logger.info("Session data cleared")

            logger.info("Order creation completed successfully")
            return Response({
                "detail": "Payment slip uploaded successfully. Order created and awaiting admin verification.",
                "order_id": order.id
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error creating order: {str(e)}", exc_info=True)
            return Response({
                "detail": f"Failed to create order: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # เก็บไว้เผื่อต้องการ (สำหรับ manual clear)
    @action(detail=False, methods=["post"])
    def clear_cart_items(self, request):
        cart = _ensure_cart(request.user)
        item_ids = request.data.get("cart_item_ids", [])
        
        if item_ids:
            CartItem.objects.filter(cart=cart, id__in=item_ids).delete()
            
            # ถ้าไม่เหลือ item ให้ล้างคูปอง
            if not cart.items.exists():
                cart.coupon = None
                cart.save(update_fields=["coupon"])
                
        return Response({"detail": "Cart items cleared."}, status=status.HTTP_200_OK)


class FavoriteViewSet(viewsets.ModelViewSet):
    serializer_class = FavoriteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        product_id = request.query_params.get("product")
        if product_id:
            obj = get_object_or_404(Favorite, user=request.user, product_id=product_id)
            obj.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        product_id = self.request.query_params.get("product")
        qs = Review.objects.all().order_by("-created_at")
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MyOrdersView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .prefetch_related("items", "payment")
            .order_by("-created_at")
        )