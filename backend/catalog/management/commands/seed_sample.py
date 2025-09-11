from django.core.management.base import BaseCommand
from catalog.models import Brand, Category, Product, ProductImage, Variant

class Command(BaseCommand):
    help = "Seed sample brands, products, variants"

    def handle(self, *args, **kwargs):
        nike,_ = Brand.objects.get_or_create(name="Nike")
        adidas,_ = Brand.objects.get_or_create(name="Adidas")
        run,_ = Category.objects.get_or_create(name="Running")
        bb,_ = Category.objects.get_or_create(name="Basketball")

        p1,_ = Product.objects.get_or_create(
            brand=nike, category=run,
            name_en="Air Zoom Pegasus 41", name_th="แอร์ ซูม เพกาซัส 41",
            base_price=3900, sale_percent=10, popularity=50,
            description_en="Lightweight daily trainer.", description_th="รองเท้าวิ่งใส่สบาย"
        )
        ProductImage.objects.get_or_create(product=p1, image_url="https://example.com/pegasus41.jpg", is_cover=True, sort_order=0)
        Variant.objects.get_or_create(product=p1, color="Black", size_eu="42", size_cm="26.5", stock=10)
        Variant.objects.get_or_create(product=p1, color="Black", size_eu="43", size_cm="27.5", stock=5)

        p2,_ = Product.objects.get_or_create(
            brand=adidas, category=bb,
            name_en="D.O.N. Issue 5", name_th="ดอน อิชชู 5",
            base_price=4200, sale_percent=0, popularity=38,
            description_en="Court-ready support.", description_th="รองเท้าบาสเกตบอล"
        )
        ProductImage.objects.get_or_create(product=p2, image_url="https://example.com/don5.jpg", is_cover=True, sort_order=0)
        Variant.objects.get_or_create(product=p2, color="White", size_eu="42", size_cm="26.5", stock=8)
        Variant.objects.get_or_create(product=p2, color="White", size_eu="44", size_cm="28.0", stock=0)

        self.stdout.write(self.style.SUCCESS("Seeded sample data."))
