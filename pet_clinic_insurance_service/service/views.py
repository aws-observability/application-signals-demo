from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import Insurance, PetInsurance
from .serializers import InsuranceSerializer, PetInsuranceSerializer
from .rest import generate_billings
import logging

logger = logging.getLogger(__name__)

class InsuranceViewSet(viewsets.ModelViewSet):
    queryset = Insurance.objects.all()
    serializer_class = InsuranceSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if not queryset:
            return []  # Return an empty list if the queryset is empty
        return queryset


class PetInsuranceViewSet(viewsets.ModelViewSet):
    queryset = PetInsurance.objects.all()
    serializer_class = PetInsuranceSerializer
    lookup_field = 'pet_id'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        owner_id = request.data.get('owner_id')
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer, owner_id)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        owner_id = request.data.get('owner_id')

        if serializer.is_valid():
            self.perform_update(serializer, owner_id)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def perform_update(self, serializer, owner_id):
        serializer.save()
        generate_billings(serializer.data, owner_id, "insurance", serializer.data.get("insurance_name"))
    def send_update_notification(self, instance):
        # Your custom logic to send a notification
        # after the instance is updated
        pass

    def get_queryset(self):
        queryset = super().get_queryset()
        if not queryset:
            return []  # Return an empty list if the queryset is empty
        return queryset

class HealthViewSet(viewsets.ViewSet):
    def list(self, request):
        return Response({'message':'ok'}, status=status.HTTP_200_OK)
