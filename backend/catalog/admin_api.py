from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.core.files.base import ContentFile

import requests

from .models import Product, ProductImage, Variant
from .serializers import (
    ProductSerializer, ProductWriteSerializer,
    ProductImageSerializer, VariantSerializer
)


class ProductAdminViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().prefetch_related("images", "variants")
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return ProductSerializer
        return ProductWriteSerializer


class ProductImageAdminViewSet(viewsets.ModelViewSet):
    queryset = ProductImage.objects.all()
    serializer_class = ProductImageSerializer
    permission_classes = [IsAdminUser]

    def _next_sort(self, product):
        return (product.images.order_by("-sort_order").first().sort_order + 1) if product.images.exists() else 1

    @action(detail=False, methods=["post"])
    def upload(self, request):
        """
        อัปโหลดจากไฟล์เครื่อง (รองรับหลายไฟล์)
        form-data:
          - product: <product_id> (required)
          - file: <file> (หลายไฟล์ได้: file, file, ...)
          - alt (optional, จะใช้กับทุกไฟล์)
        """
        product_id = request.data.get("product")
        if not product_id:
            return Response({"detail": "product required"}, status=400)

        product = get_object_or_404(Product, pk=product_id)
        files = request.FILES.getlist("file")
        if not files:
            return Response({"detail": "no files"}, status=400)

        alt = request.data.get("alt", "")
        created = []
        with transaction.atomic():
            for f in files:
                im = ProductImage(
                    product=product,
                    alt=alt,
                    sort_order=self._next_sort(product),
                )
                im.file = f
                im.save()
                created.append(ProductImageSerializer(im, context={"request": request}).data)

        return Response(created, status=201)

    @action(detail=False, methods=["post"])
    def add_by_url(self, request):
        """
        นำเข้ารูปจาก URL — backend เป็นคนดาวน์โหลด แล้วบันทึกเป็นไฟล์จริง
        body (JSON or form-data):
          - product: <product_id> (required)
          - image_url/url/url_source: <url> (required)
          - alt (optional)
        """
        product_id = request.data.get("product")
        image_url = request.data.get("image_url") or request.data.get("url") or request.data.get("url_source")
        if not product_id or not image_url:
            return Response({"detail": "product and image_url required"}, status=400)

        product = get_object_or_404(Product, pk=product_id)

        try:
            r = requests.get(image_url, timeout=10)
            r.raise_for_status()
            ctype = (r.headers.get("Content-Type") or "").lower()
            if not ("image" in ctype or any(x in image_url.lower() for x in [".jpg",".jpeg",".png",".webp",".gif",".heic",".heif"])):
                return Response({"detail": f"unsupported content-type: {ctype}"}, status=415)

            # ตั้งชื่อไฟล์เบื้องต้นจาก URL
            filename = image_url.split("?")[0].split("/")[-1] or "image"
            im = ProductImage(
                product=product,
                url_source=image_url,
                alt=request.data.get("alt", ""),
                sort_order=self._next_sort(product),
            )
            im.file.save(filename, ContentFile(r.content))
            im.save()
            return Response(ProductImageSerializer(im, context={"request": request}).data, status=201)
        except requests.RequestException as e:
            return Response({"detail": str(e)}, status=400)

    @action(detail=True, methods=["post"])
    def set_cover(self, request, pk=None):
        im = get_object_or_404(ProductImage, pk=pk)
        with transaction.atomic():
            ProductImage.objects.filter(product=im.product).update(is_cover=False)
            im.is_cover = True
            im.save(update_fields=["is_cover"])
        return Response({"ok": True})

    @action(detail=False, methods=["post"])
    def reorder(self, request):
        """
        body: { "orders": [ { "id": <image_id>, "sort_order": <int> }, ... ] }
        """
        orders = request.data.get("orders", [])
        if not isinstance(orders, list):
            return Response({"detail": "orders must be list"}, status=400)
        with transaction.atomic():
            for item in orders:
                try:
                    im = ProductImage.objects.get(pk=item["id"])
                    im.sort_order = int(item["sort_order"])
                    im.save(update_fields=["sort_order"])
                except Exception:
                    continue
        return Response({"ok": True})


class VariantAdminViewSet(viewsets.ModelViewSet):
    queryset = Variant.objects.all()
    serializer_class = VariantSerializer
    permission_classes = [IsAdminUser]
