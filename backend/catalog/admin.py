from django.contrib import admin
from .models import Brand, Category, Product, ProductImage, Variant
from django import forms


class ProductImageForm(forms.ModelForm):
    class Meta:
        model = ProductImage
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        product = kwargs.pop("product", None)
        super().__init__(*args, **kwargs)

        if product:
            qs = Variant.objects.filter(product=product)
        elif self.instance and self.instance.product_id:
            qs = Variant.objects.filter(product_id=self.instance.product_id)
        else:
            qs = Variant.objects.none()

        colors = list(qs.values_list("color", flat=True).distinct())
        self.fields["color"].widget = forms.Select(
            choices=[("", "—")] + [(c, c) for c in colors]
        )


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    form = ProductImageForm
    extra = 1
    fields = ("file", "url_source", "color", "is_cover", "sort_order")


class VariantInline(admin.TabularInline):
    model = Variant
    extra = 1
    fields = ("color", "size_eu", "size_cm", "stock")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id", "name_en", "brand",
        "base_price", "sale_percent",
        "popularity", "is_active", "is_recommended",  # ✅ โชว์ในตาราง
    )
    list_filter = ("brand", "category", "is_active", "is_recommended")  # ✅ filter
    search_fields = ("name_en", "name_th")
    inlines = [ProductImageInline, VariantInline]
    list_editable = ("is_active", "is_recommended")  # ✅ แก้ได้จาก list view


admin.site.register(Brand)
admin.site.register(Category)
