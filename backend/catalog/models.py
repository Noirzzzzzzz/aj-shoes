from django.db import models
from django.core.files.base import ContentFile
from PIL import Image, ImageOps
import hashlib
import os

# ---------- Base Models ----------

class Brand(models.Model):
    name = models.CharField(max_length=120, unique=True)

    def __str__(self):
        return self.name


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)

    def __str__(self):
        return self.name


class Product(models.Model):
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="products")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products", null=True, blank=True)

    name_en = models.CharField(max_length=255)
    name_th = models.CharField(max_length=255, blank=True, default="")
    description_en = models.TextField(blank=True, default="")
    description_th = models.TextField(blank=True, default="")

    base_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sale_percent = models.PositiveIntegerField(default=0)

    popularity = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    is_recommended = models.BooleanField(default=False)  # ✅ ฟิลด์ใหม่

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name_en

    @property
    def sale_price(self):
        if self.sale_percent > 0:
            return round(float(self.base_price) * (100 - self.sale_percent) / 100, 2)
        return float(self.base_price)


# ---------- ProductImage ----------
def product_image_upload_to(instance, filename):
    base, ext = os.path.splitext(filename.lower() or "image")
    h = hashlib.sha1((filename or "image").encode("utf-8")).hexdigest()[:16]
    return f"products/{instance.product_id}/{h}{ext or '.jpg'}"


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    file = models.ImageField(upload_to=product_image_upload_to, blank=True, null=True)
    url_source = models.URLField(blank=True, default="")

    alt = models.CharField(max_length=255, blank=True, default="")
    is_cover = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    color = models.CharField(max_length=64, blank=True, default="")

    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    checksum = models.CharField(max_length=64, blank=True, default="")

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return f"Image(product={self.product_id}, id={self.pk})"

    def _update_dimensions_and_checksum(self):
        if not self.file:
            return
        try:
            self.file.open("rb")
            im = Image.open(self.file)
            im = ImageOps.exif_transpose(im)
            self.width, self.height = im.size
        except Exception:
            pass

        try:
            h = hashlib.sha256()
            for chunk in self.file.chunks():
                h.update(chunk)
            self.checksum = h.hexdigest()
        except Exception:
            pass

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        before_w, before_h, before_ck = self.width, self.height, self.checksum
        self._update_dimensions_and_checksum()
        changed_fields = []
        if (self.width, self.height) != (before_w, before_h):
            changed_fields += ["width", "height"]
        if self.checksum != before_ck:
            changed_fields += ["checksum"]
        if changed_fields:
            super(ProductImage, self).save(update_fields=changed_fields)


class Variant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    color = models.CharField(max_length=64)
    size_eu = models.CharField(max_length=8)
    size_cm = models.CharField(max_length=8)
    stock = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("product", "color", "size_eu", "size_cm")

    def __str__(self):
        return f"{self.product_id} {self.color} EU{self.size_eu} / {self.size_cm}cm"
