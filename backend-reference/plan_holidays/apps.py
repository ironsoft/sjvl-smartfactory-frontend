from django.apps import AppConfig


class PlanHolidaysConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"  # pyright: ignore[reportAssignmentType, reportIncompatibleVariableOverride]
    name = "plan_holidays"
    verbose_name = "VL plan holidays"
