from django.contrib import admin
from .models import Brand, Category, Product, ProductImage, Variant

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1

class VariantInline(admin.TabularInline):
    model = Variant
    extra = 1

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "name_en", "brand", "base_price", "sale_percent", "is_active")
    list_filter = ("brand", "category", "is_active")
    search_fields = ("name_en", "name_th")
    inlines = [ProductImageInline, VariantInline]

admin.site.register(Brand)
admin.site.register(Category)
