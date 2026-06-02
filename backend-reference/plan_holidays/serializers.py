from rest_framework import serializers

from .models import VlPlanHoliday


class VlPlanHolidaySerializer(serializers.ModelSerializer):
    """pk는 모델 필드가 아니므로 id 매핑(API·프론트 모두 `pk`로 통일)."""
    pk = serializers.IntegerField(read_only=True, source="id")
    date = serializers.DateField()

    class Meta:
        model = VlPlanHoliday
        fields = ("pk", "date", "name", "created_at", "updated_at")
        read_only_fields = ("pk", "created_at", "updated_at")
