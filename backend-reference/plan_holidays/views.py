from datetime import datetime

from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.response import Response

from .models import VlPlanHoliday
from .serializers import VlPlanHolidaySerializer


def _parse_iso_date(s: str):
    return datetime.strptime(s, "%Y-%m-%d").date()


class VlPlanHolidayViewSet(viewsets.ModelViewSet):
    """
    GET ?date_from=&date_to= (inclusive) → {"results": [...]}
    POST { date, name? }
    DELETE /pk/
    """

    serializer_class = VlPlanHolidaySerializer
    queryset = VlPlanHoliday.objects.all()
    http_method_names = ["get", "post", "delete", "head", "options"]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        ser = self.get_serializer(queryset, many=True)
        return Response({"results": ser.data})

    def get_queryset(self):
        qs = super().get_queryset()
        df = self.request.query_params.get("date_from")
        dt = self.request.query_params.get("date_to")
        if df and dt:
            try:
                lo = _parse_iso_date(df)
                hi = _parse_iso_date(dt)
                qs = qs.filter(date__gte=lo, date__lte=hi)
            except ValueError:
                pass
        elif y := self.request.query_params.get("year"):
            try:
                yi = int(y)
                qs = qs.filter(date__year=yi)
            except ValueError:
                pass
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        date_raw = data.get("date")
        if not date_raw:
            return Response({"detail": "date is required"}, status=status.HTTP_400_BAD_REQUEST)
        if isinstance(date_raw, str):
            try:
                d = _parse_iso_date(date_raw[:10])
            except ValueError:
                return Response({"detail": "invalid date"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"detail": "invalid date"}, status=status.HTTP_400_BAD_REQUEST)
        name = (data.get("name") or "").strip()[:200]
        with transaction.atomic():
            obj, _created = VlPlanHoliday.objects.update_or_create(
                date=d, defaults={"name": name}
            )
        ser = VlPlanHolidaySerializer(obj, context={"request": request})
        return Response(ser.data, status=status.HTTP_201_CREATED)
