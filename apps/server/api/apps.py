from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api"

    # def ready(self):
    #     from .tasks import processing_monitor

    #     processing_monitor.apply_async()
