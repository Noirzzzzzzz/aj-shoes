# coupons/management/commands/create_sample_coupons.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from coupons.models import Coupon

class Command(BaseCommand):
    help = 'Create sample coupons for testing'

    def handle(self, *args, **options):
        now = timezone.now()
        
        # สร้างคูปองตัวอย่าง
        coupons = [
            {
                'code': 'SAVE10',
                'discount_type': Coupon.DiscountType.PERCENT,
                'percent_off': 10,
                'min_spend': 100,
                'max_uses': 50,
                'valid_to': now + timedelta(days=30)
            },
            {
                'code': 'SAVE20',
                'discount_type': Coupon.DiscountType.PERCENT,
                'percent_off': 20,
                'min_spend': 500,
                'max_uses': 25,
                'valid_to': now + timedelta(days=30)
            },
            {
                'code': 'FREESHIP',
                'discount_type': Coupon.DiscountType.FREE_SHIPPING,
                'percent_off': 0,
                'min_spend': 0,
                'max_uses': 100,
                'valid_to': now + timedelta(days=30)
            },
            {
                'code': 'FREESHIP200',
                'discount_type': Coupon.DiscountType.FREE_SHIPPING,
                'percent_off': 0,
                'min_spend': 200,
                'max_uses': 100,
                'valid_to': now + timedelta(days=30)
            }
        ]
        
        created_count = 0
        for coupon_data in coupons:
            coupon, created = Coupon.objects.get_or_create(
                code=coupon_data['code'],
                defaults=coupon_data
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created coupon: {coupon.code}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'Coupon already exists: {coupon.code}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created_count} new coupons')
        )