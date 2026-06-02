from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import VlPlanHolidayViewSet

router = DefaultRouter()
router.register("", VlPlanHolidayViewSet, basename="vl-plan-holidays")

urlpatterns = router.urls
