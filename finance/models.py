from django.db import models

# Create your models here.
from django.db import models


class FeeCollection(models.Model):
    PAYMENT_MODES = [
        ('Cash', 'Cash'),
        ('UPI', 'UPI'),
        ('Card', 'Card'),
        ('Bank Transfer', 'Bank Transfer'),
    ]

    id = models.AutoField(primary_key=True)

    student_reg_number = models.CharField(
        max_length=50
    )

    amount_paid = models.PositiveIntegerField()

    expected_fee = models.PositiveIntegerField(
        blank=True,
        null=True,
    )

    is_verified = models.BooleanField(
        default=False,
    )

    payment_mode = models.CharField(
        max_length=30,
        choices=PAYMENT_MODES
    )

    academic_term = models.CharField(
        max_length=50
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"{self.student_reg_number} - ₹{self.amount_paid}"

    class Meta:
        db_table = 'fee_collections'
        ordering = ['-created_at']