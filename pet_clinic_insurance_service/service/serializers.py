from rest_framework import serializers
from .models import Insurance, PetInsurance

class InsuranceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Insurance
        fields = ['id', 'name', 'description', 'price']

class PetInsuranceSerializer(serializers.ModelSerializer):
    class Meta:
        model = PetInsurance
        fields = ['id', 'pet_id', 'insurance_id', 'insurance_name', 'price']