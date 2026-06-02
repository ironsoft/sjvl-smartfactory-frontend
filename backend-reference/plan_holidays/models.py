from django.db import models


class VlPlanHoliday(models.Model):
    """VL 조립 생산 계획 시 근무일(1 day)에서 제외되는 날짜. 일요일은 프론트/서버 로직에서 항상 제외."""

    date = models.DateField(unique=True, db_index=True)
    name = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date"]
        verbose_name = "VL plan holiday"
        verbose_name_plural = "VL plan holidays"

    def __str__(self):
        return f"{self.date} {self.name}".strip()
