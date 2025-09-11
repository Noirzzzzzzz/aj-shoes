# orders/views.py
from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.utils import timezone

from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Address, Cart, CartItem, Order, OrderItem, Favorite, Review, PaymentConfig
from .serializers import (
    AddressSerializer,
    CartSerializer,
    CartItemSerializer,
    OrderSerializer,
    FavoriteSerializer,
    ReviewSerializer,
    PaymentConfigSerializer,
)

User = get_user_model()


def _ensure_cart(user):
    cart, _ = Cart.objects.get_or_create(user=user)
    return cart


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

        return Response(CartItemSerializer(item, context={'request': request}).data, status=status.HTTP_201_CREATED)

    # PATCH /api/orders/cart/<pk>/
    def partial_update(self, request, pk=None):
        cart = _ensure_cart(request.user)
        item = get_object_or_404(CartItem, pk=pk, cart=cart)
        qty = int(request.data.get("quantity", 1))
        if qty < 1:
            qty = 1
        item.quantity = qty
        item.save()
        return Response(CartItemSerializer(item, context={'request': request}).data)

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
            cart, data={"coupon_code": request.data.get("code", "")}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(CartSerializer(cart, context={'request': request}).data)

    # POST /api/orders/cart/checkout/
    @action(detail=False, methods=["post"])
    def checkout(self, request):
        cart = _ensure_cart(request.user)

        address_id = request.data.get("address_id")
        if not address_id:
            return Response({"detail": "address_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        address = get_object_or_404(Address, id=address_id, user=request.user)

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

        # Calculate total before creating order
        total = 0.0
        for it in qs:
            if it.variant.stock < it.quantity:
                raise ValidationError(
                    {"detail": f"Insufficient stock for {it.product.name} (variant {it.variant.id})."}
                )
            price = float(it.product.sale_price)
            total += price * it.quantity

        # Apply coupon discount
        shipping_cost = 50
        if cart.coupon:
            c = cart.coupon
            if c.discount_type == "percent":
                total = total * (100 - c.percent_off) / 100
            elif c.discount_type == "free_shipping":
                shipping_cost = 0

        final_total = total + shipping_cost

        with transaction.atomic():
            # Create order in PENDING_PAYMENT status
            order = Order.objects.create(
                user=request.user,
                address=address,
                shipping_carrier=request.data.get("carrier", "Kerry"),
                shipping_cost=shipping_cost,
                coupon=cart.coupon,
                total=round(final_total, 2),
                status=Order.Status.PENDING_PAYMENT,
            )

            # Create order items but don't reduce stock yet
            for it in qs:
                price = float(it.product.sale_price)
                OrderItem.objects.create(
                    order=order,
                    product=it.product,
                    variant=it.variant,
                    price=price,
                    quantity=it.quantity,
                )

            # Update coupon usage
            if cart.coupon:
                c = cart.coupon
                c.uses_count = F("uses_count") + 1
                c.save(update_fields=["uses_count"])

        # Return order with payment config for frontend
        payment_config = PaymentConfig.objects.filter(is_active=True).first()
        response_data = {
            "order": OrderSerializer(order, context={'request': request}).data,
            "payment_config": PaymentConfigSerializer(payment_config, context={'request': request}).data if payment_config else None,
            "requires_payment": True
        }

        return Response(response_data, status=status.HTTP_201_CREATED)


class OrderViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    # GET /api/orders/<order_id>/
    def retrieve(self, request, pk=None):
        order = get_object_or_404(Order, pk=pk, user=request.user)
        return Response(OrderSerializer(order, context={'request': request}).data)

    # POST /api/orders/<order_id>/upload-payment/
    @action(detail=True, methods=["post"])
    def upload_payment(self, request, pk=None):
        order = get_object_or_404(Order, pk=pk, user=request.user)
        
        if order.status != Order.Status.PENDING_PAYMENT:
            return Response(
                {"detail": "Order is not awaiting payment"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if order.is_payment_expired:
            return Response(
                {"detail": "Payment deadline has expired"},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment_slip = request.FILES.get('payment_slip')
        if not payment_slip:
            return Response(
                {"detail": "Payment slip is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        order.payment_slip = payment_slip
        order.save()

        return Response(
            {"detail": "Payment slip uploaded successfully. Awaiting admin verification."},
            status=status.HTTP_200_OK
        )

    # POST /api/orders/<order_id>/cancel/
    @action(detail=True, methods=["post"])
    def cancel_order(self, request, pk=None):
        order = get_object_or_404(Order, pk=pk, user=request.user)
        
        if order.status != Order.Status.PENDING_PAYMENT:
            return Response(
                {"detail": "Order cannot be cancelled"},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Restore cart items
            cart = _ensure_cart(request.user)
            for order_item in order.items.all():
                cart_item, created = CartItem.objects.get_or_create(
                    cart=cart,
                    product=order_item.product,
                    variant=order_item.variant,
                    defaults={"quantity": order_item.quantity}
                )
                if not created:
                    cart_item.quantity = F("quantity") + order_item.quantity
                    cart_item.save()

            # Cancel the order
            order.status = Order.Status.CANCELLED
            order.save()

        return Response(
            {"detail": "Order cancelled successfully. Items restored to cart."},
            status=status.HTTP_200_OK
        )


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
            .exclude(status=Order.Status.PENDING_PAYMENT)  # ซ่อน pending payment orders
            # ไม่ต้อง exclude cancelled เพราะ cancelled orders จะถูกลบออกจากฐานข้อมูลแล้ว
            .prefetch_related("items")
            .order_by("-created_at")
        )


class PaymentConfigView(generics.RetrieveAPIView):
    """Get active payment configuration"""
    serializer_class = PaymentConfigSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return PaymentConfig.objects.filter(is_active=True).first()