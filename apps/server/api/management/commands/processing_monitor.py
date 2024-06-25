from django.core.management.base import BaseCommand
import time
from api.tasks import processing_monitor


class Command(BaseCommand):
    help = "Runs a background task"

    def handle(self, *args, **kwargs):
        while True:
            self.stdout.write(self.style.SUCCESS("Starting background task..."))
            processing_monitor()
