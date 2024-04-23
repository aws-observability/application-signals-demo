"""
URL configuration for pet_clinic_insurance_service project.

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
from service.views import InsuranceViewSet, PetInsuranceViewSet, HealthViewSet

router = DefaultRouter()
router.register(r'insurances', InsuranceViewSet)
router.register(r'pet-insurances', PetInsuranceViewSet)
router.register('health', HealthViewSet, basename='health')

urlpatterns = [
    path("admin/", admin.site.urls),
    path('', include(router.urls)),
    # path('api/', include((router.urls, 'service'), namespace='service')),
]
