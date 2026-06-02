from django.contrib import admin

from .models import VlPlanHoliday


@admin.register(VlPlanHoliday)
class VlPlanHolidayAdmin(admin.ModelAdmin):
    """관리 사이트: 등록 후 앱 이름(VL plan holidays)으로 그룹에 표시됩니다."""

    list_display = ("id", "date", "name", "created_at", "updated_at")
    list_display_links = ("date",)
    search_fields = ("name",)
    ordering = ("date",)
    date_hierarchy = "date"
