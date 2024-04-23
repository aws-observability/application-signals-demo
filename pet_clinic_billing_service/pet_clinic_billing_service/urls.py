"""
URL configuration for pet_clinic_billing_service project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from billing_service.views import HealthViewSet, BillingViewSet

router = DefaultRouter()
router.register('billings', BillingViewSet, basename='billings')
router.register('health', HealthViewSet, basename='health')
urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include(router.urls)),
    path('billings/<int:owner_id>/<int:pet_id>/<str:type>/', BillingViewSet.as_view({'get': 'retrieve'}), name='billing-retrieve'),
]
