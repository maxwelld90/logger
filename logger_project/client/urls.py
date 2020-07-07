from django.urls import path
from client.views import landing

urlpatterns = [
    path('', landing, name='landing'),
]