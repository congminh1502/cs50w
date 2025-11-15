# flights/management/commands/wait_for_db.py
import time
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError

class Command(BaseCommand):
    help = "Wait for database to be available"

    def handle(self, *args, **options):
        self.stdout.write("Waiting for database...", ending="\n")
        while True:
            try:
                # ensure_connection will raise OperationalError if DB not ready
                connections['default'].ensure_connection()
                break
            except OperationalError:
                self.stdout.write("Database unavailable, sleeping 1s...", ending="\n")
                time.sleep(1)

        self.stdout.write(self.style.SUCCESS("Database is available!"))
