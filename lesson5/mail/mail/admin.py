from django.contrib import admin
from .models import User, Email  # Import your models

# Register your models here.
admin.site.register(User)
admin.site.register(Email)