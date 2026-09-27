from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import FeeCollection


@admin.register(FeeCollection)
class FeeCollectionAdmin(admin.ModelAdmin):

    list_display = (
        'id',
        'student_reg_number',
        'amount_paid',
        'payment_mode',
        'academic_term',
        'created_at',
    )

    list_filter = (
        'payment_mode',
        'academic_term',
    )

    search_fields = (
        'student_reg_number',
    )

    ordering = (
        '-created_at',
    )