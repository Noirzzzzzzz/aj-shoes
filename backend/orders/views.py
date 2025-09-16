# orders/views.py — PATCHED (add-only/related changes)
from django.db import transaction
from django.db.models import F, Avg, Count
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.utils import timezone

from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from decimal import Decimal  # ✅ NEW
from coupons.models import Coupon, UserCoupon  # ✅ NEW

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

    # ----------------- session coupons helpers (NEW) -----------------
    def _get_session_coupons(self, request):
        """คืน (percent_coupon, free_coupon) ที่ยัง valid และ user เก็บไว้แล้ว"""
        data = request.session.get("cart_coupons") or {}
        percent_code = (data.get("percent") or "").strip()
        free_code = (data.get("free") or "").strip()

        def resolve(code):
            if not code:
                return None
            c = Coupon.objects.filter(code__iexact=code).first()
            if not c or not c.is_active():
                return None
            if not UserCoupon.objects.filter(user=request.user, coupon=c).exists():
                return None
            return c

        return resolve(percent_code), resolve(free_code)

    def _set_session_coupons(self, request, codes):
        """
        เซ็ตคูปองใน session:
        - เลือกได้ 1 ใบประเภทเปอร์เซ็นต์ (เอา % สูงสุด)
        - เลือกได้ 1 ใบประเภทส่งฟรี
        """
        if isinstance(codes, str):
            codes = [codes]
        codes = [str(c).strip() for c in (codes or []) if c]

        best_percent, free_ship = None, None
        for c in Coupon.objects.filter(code__in=codes):
            if not c.is_active():
                continue
            if not UserCoupon.objects.filter(user=request.user, coupon=c).exists():
                continue
            if c.discount_type == "percent":
                if (best_percent is None) or (int(c.percent_off or 0) > int(best_percent.percent_off or 0)):
                    best_percent = c
            elif c.discount_type == "free_shipping":
                free_ship = c

        request.session["cart_coupons"] = {
            "percent": best_percent.code if best_percent else None,
            "free": free_ship.code if free_ship else None,
        }
        request.session.modified = True
        return self._get_session_coupons(request)

    def _summary(self, request, cart):
        """
        คำนวณ subtotal/discount/shipping/total + รายชื่อคูปองที่ใช้
        ใช้คูปองจาก session ถ้ามี; ถ้าไม่มีให้ fallback เป็น cart.coupon (ของเดิม)
        """
        items = cart.items.select_related("product", "variant")
        subtotal = Decimal("0.00")
        for it in items:
            subtotal += Decimal(str(it.product.sale_price)) * it.quantity

        shipping_base = Decimal("50.00")

        # session coupons
        percent_c, free_c = self._get_session_coupons(request)

        # fallback: cart.coupon เดิม (ใบเดียว)
        if cart.coupon and (not percent_c and not free_c):
            if cart.coupon.discount_type == "percent":
                percent_c = cart.coupon
            elif cart.coupon.discount_type == "free_shipping":
                free_c = cart.coupon

        discount_percent = int(percent_c.percent_off) if percent_c else 0
        discount_amount = (subtotal * Decimal(discount_percent) / Decimal(100)) if discount_percent else Decimal("0.00")
        # ปัดเป็นบาท (เปลี่ยนเป็น Decimal("0.01") ถ้าต้องการสตางค์)
        discount_amount = discount_amount.quantize(Decimal("1"))

        shipping_fee = Decimal("0.00") if free_c else shipping_base
        total = subtotal - discount_amount + shipping_fee
        if total < 0:
            total = Decimal("0.00")

        applied = []
        if percent_c:
            applied.append({"code": percent_c.code, "discount_type": "percent", "percent_off": discount_percent})
        if free_c:
            applied.append({"code": free_c.code, "discount_type": "free_shipping"})

        return {
            "subtotal": float(subtotal),
            "discount_amount": float(discount_amount),
            "discount_percent": discount_percent,
            "free_shipping": bool(free_c),
            "shipping_fee": float(shipping_fee),
            "applied_coupons": applied,
            "total": float(total),
        }

    # GET /api/orders/cart/
    def list(self, request):
        cart = _ensure_cart(request.user)
        data = CartSerializer(cart, context={'request': request}).data  # ของเดิม
        data.update(self._summary(request, cart))  # ✅ เพิ่มสรุปใหม่
        return Response(data)

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

        # ✅ โหมดใหม่: หลายโค้ด
        codes = request.data.get("coupon_codes", None)
        if isinstance(codes, (list, tuple)) and len(codes) > 0:
            self._set_session_coupons(request, codes)
            data = CartSerializer(cart, context={'request': request}).data
            data.update(self._summary(request, cart))
            return Response(data)

        # โหมดเดิม: { "code": "ABC" } → เซ็ตลง cart.coupon ผ่าน serializer เดิม
        serializer = CartSerializer(
            cart, data={"coupon_code": request.data.get("code", "")}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # เคลียร์ session เพื่อให้ fallback เป็น cart.coupon
        request.session["cart_coupons"] = {"percent": None, "free": None}
        request.session.modified = True

        data = CartSerializer(cart, context={'request': request}).data
        data.update(self._summary(request, cart))
        return Response(data)

    # POST /api/orders/cart/remove-coupon/  (NEW)
    @action(detail=False, methods=["post"])
    def remove_coupon(self, request):
        cart = _ensure_cart(request.user)
        code = (request.data.get("code") or "").strip()

        # ลบจาก session ก่อน
        current = request.session.get("cart_coupons") or {"percent": None, "free": None}
        if code:
            if current.get("percent") and current["percent"].lower() == code.lower():
                current["percent"] = None
            if current.get("free") and current["free"].lower() == code.lower():
                current["free"] = None
        else:
            current = {"percent": None, "free": None}
        request.session["cart_coupons"] = current
        request.session.modified = True

        # ถ้ายังมี code ตรงกับ cart.coupon เดิม ให้เคลียร์เพื่อความเข้ากันได้
        if code and cart.coupon and cart.coupon.code.lower() == code.lower():
            cart.coupon = None
            cart.save(update_fields=["coupon"])
        if not code and cart.coupon:
            cart.coupon = None
            cart.save(update_fields=["coupon"])

        data = CartSerializer(cart, context={'request': request}).data
        data.update(self._summary(request, cart))
        return Response(data)

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

        shipping_cost = 50.0

        # ✅ ใช้คูปองจาก session (ส่วนลด% + ส่งฟรีพร้อมกัน)
        percent_c, free_c = self._get_session_coupons(request)

        # fallback ของเดิม: cart.coupon (ใบเดียว)
        if cart.coupon and (not percent_c and not free_c):
            if cart.coupon.discount_type == "percent":
                percent_c = cart.coupon
            elif cart.coupon.discount_type == "free_shipping":
                free_c = cart.coupon

        # Apply coupon discount (คงโครงของเดิม แต่ขยายกรณี free+percent)
        if percent_c and percent_c.discount_type == "percent":
            total = total * (100.0 - float(percent_c.percent_off or 0)) / 100.0
        if free_c and free_c.discount_type == "free_shipping":
            shipping_cost = 0.0

        final_total = total + shipping_cost

        with transaction.atomic():
            # Create order in PENDING_PAYMENT status
            order = Order.objects.create(
                user=request.user,
                address=address,
                shipping_carrier=request.data.get("carrier", "Kerry"),
                shipping_cost=shipping_cost,
                coupon=cart.coupon,  # เก็บใบเดิมไว้เพื่อความเข้ากันได้
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

            # Update coupon usage (ของเดิม + ครอบคลุม session coupons)
            if cart.coupon:
                c = cart.coupon
                c.uses_count = F("uses_count") + 1
                c.save(update_fields=["uses_count"])
            if percent_c and (not cart.coupon or cart.coupon.id != percent_c.id):
                percent_c.uses_count = F("uses_count") + 1
                percent_c.save(update_fields=["uses_count"])
            if free_c and (not cart.coupon or cart.coupon.id != free_c.id):
                free_c.uses_count = F("uses_count") + 1
                free_c.save(update_fields=["uses_count"])

        # Return order with payment config for frontend
        payment_config = PaymentConfig.objects.filter(is_active=True).first()
        response_data = {
            "order": OrderSerializer(order, context={'request': request}).data,
            "payment_config": PaymentConfigSerializer(payment_config, context={'request': request}).data if payment_config else None,
            "requires_payment": True
        }

        # ✅ เคลียร์คูปองจาก session หลัง checkout
        request.session["cart_coupons"] = {"percent": None, "free": None}
        request.session.modified = True

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


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return getattr(obj, "user_id", None) == getattr(request.user, "id", None)


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        """
        รองรับ ?product=<id>
        default เรียงใหม่สุดก่อน
        """
        product_id = self.request.query_params.get("product")
        qs = Review.objects.select_related("user", "product").order_by("-created_at")
        if product_id:
            qs = qs.filter(product_id=product_id)
        return qs

    def list(self, request, *args, **kwargs):
        """
        รองรับการอ่าน 'ทั้งหมด' แบบแบ่งหน้า:
        - ?page=<n> (เริ่ม 1)
        - ?page_size=<n> (ดีฟอลต์ 20)
        ถ้ามี DRF paginator ใน settings จะใช้ของ DRF อัตโนมัติ
        ถ้าไม่มี จะทำ fallback pagination เอง
        """
        queryset = self.get_queryset()

        # ลองใช้ paginator ของ DRF ก่อน (ถ้าตั้งค่าไว้)
        page = self.paginate_queryset(queryset)
        if page is not None:
            data = ReviewSerializer(page, many=True, context={"request": request}).data
            return self.get_paginated_response(data)

        # fallback pagination แบบง่าย
        try:
            page_num = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            page_num = 1
        try:
            page_size = max(1, int(request.query_params.get("page_size", 20)))
        except ValueError:
            page_size = 20

        start = (page_num - 1) * page_size
        end = start + page_size
        total = queryset.count()
        items = queryset[start:end]
        data = ReviewSerializer(items, many=True, context={"request": request}).data
        return Response({
            "count": total,
            "page": page_num,
            "page_size": page_size,
            "results": data
        })

    def perform_create(self, serializer):
        """
        ✅ ให้รีวิวได้เฉพาะสินค้าที่อยู่ในออเดอร์สถานะ delivered เท่านั้น
        """
        user = self.request.user
        product = serializer.validated_data.get("product")

        purchased = OrderItem.objects.filter(
            order__user=user,
            order__status=Order.Status.DELIVERED,
            product=product,
        ).exists()

        if not purchased:
            raise ValidationError({"detail": "You can review only products that have been delivered."})

        serializer.save(user=user)

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def summary(self, request):
        """
        GET /api/orders/reviews/summary/?product=<id>&limit=10
        คืน {"total": <int>, "items": [ ...แค่ตัวอย่างล่าสุด... ]}
        """
        product_id = request.query_params.get("product")
        if not product_id:
            return Response({"detail": "product is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            limit = int(request.query_params.get("limit", 10))
        except ValueError:
            limit = 10

        base_qs = Review.objects.filter(product_id=product_id).select_related("user").order_by("-created_at")
        total = base_qs.count()
        items = base_qs[:max(0, limit)]
        data = ReviewSerializer(items, many=True, context={"request": request}).data
        return Response({"total": total, "items": data})
    
    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def aggregate(self, request):
        """
        GET /api/orders/reviews/aggregate/?product=<id>
        คืน summary เช่น {
          "average": 4.2,
          "total": 37,
          "stars": { "1": 2, "2": 3, "3": 5, "4": 12, "5": 15 }
        }
        """
        product_id = request.query_params.get("product")
        if not product_id:
            return Response({"detail": "product is required"}, status=status.HTTP_400_BAD_REQUEST)

        qs = Review.objects.filter(product_id=product_id)
        total = qs.count()
        avg = qs.aggregate(avg=Avg("rating"))["avg"] or 0

        # นับจำนวนรีวิวแต่ละดาว
        counts = qs.values("rating").annotate(c=Count("id"))
        stars = {str(i): 0 for i in range(1, 6)}
        for row in counts:
            stars[str(row["rating"])] = row["c"]

        return Response({
            "average": round(avg, 2),
            "total": total,
            "stars": stars,
        })

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
