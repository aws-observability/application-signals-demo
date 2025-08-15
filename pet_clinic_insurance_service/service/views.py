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
        logger.info("InsuranceViewSet.get_queryset() called - Fetching insurance records")
        queryset = super().get_queryset()
        if not queryset:
            logger.warning("InsuranceViewSet.get_queryset() - No insurance records found")
            return []  # Return an empty list if the queryset is empty
        logger.info(f"InsuranceViewSet.get_queryset() - Found {len(queryset)} insurance records")
        return queryset


class PetInsuranceViewSet(viewsets.ModelViewSet):
    queryset = PetInsurance.objects.all()
    serializer_class = PetInsuranceSerializer
    lookup_field = 'pet_id'

    def create(self, request, *args, **kwargs):
        owner_id = request.data.get('owner_id')
        pet_id = request.data.get('pet_id')
        logger.info(f"PetInsuranceViewSet.create() called - Creating pet insurance for owner_id: {owner_id}, pet_id: {pet_id}")
        logger.debug(f"Request data: {request.data}")
        
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer, owner_id)
            headers = self.get_success_headers(serializer.data)
            logger.info(f"PetInsuranceViewSet.create() - Pet insurance created successfully for pet_id: {pet_id}")
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            logger.error(f"PetInsuranceViewSet.create() - Failed to create pet insurance: {str(e)}")
            raise

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        pet_id = instance.pet_id
        owner_id = request.data.get('owner_id')
        logger.info(f"PetInsuranceViewSet.update() called - Updating pet insurance for pet_id: {pet_id}, owner_id: {owner_id}")
        logger.debug(f"Request data: {request.data}")
        
        serializer = self.get_serializer(instance, data=request.data, partial=True)

        if serializer.is_valid():
            self.perform_update(serializer, owner_id)
            logger.info(f"PetInsuranceViewSet.update() - Pet insurance updated successfully for pet_id: {pet_id}")
            return Response(serializer.data)
        
        logger.error(f"PetInsuranceViewSet.update() - Validation failed for pet_id: {pet_id}, errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def perform_update(self, serializer, owner_id):
        logger.info(f"PetInsuranceViewSet.perform_update() called - Saving pet insurance and generating billing")
        try:
            serializer.save()
            insurance_name = serializer.data.get("insurance_name")
            logger.debug(f"Generating billing for owner_id: {owner_id}, insurance_name: {insurance_name}")
            generate_billings(serializer.data, owner_id, "insurance", insurance_name)
            logger.info(f"PetInsuranceViewSet.perform_update() - Successfully saved and generated billing for owner_id: {owner_id}")
        except Exception as e:
            logger.error(f"PetInsuranceViewSet.perform_update() - Failed to save or generate billing: {str(e)}")
            raise
    def send_update_notification(self, instance):
        # Your custom logic to send a notification
        # after the instance is updated
        logger.info(f"PetInsuranceViewSet.send_update_notification() called - Sending notification for pet_id: {instance.pet_id}")
        logger.debug("PetInsuranceViewSet.send_update_notification() - Notification logic not implemented yet")
        pass

    def get_queryset(self):
        logger.info("PetInsuranceViewSet.get_queryset() called - Fetching pet insurance records")
        queryset = super().get_queryset()
        if not queryset:
            logger.warning("PetInsuranceViewSet.get_queryset() - No pet insurance records found")
            return []  # Return an empty list if the queryset is empty
        logger.info(f"PetInsuranceViewSet.get_queryset() - Found {len(queryset)} pet insurance records")
        return queryset

class HealthViewSet(viewsets.ViewSet):
    def list(self, request):
        logger.info("HealthViewSet.list() called - Health check requested")
        logger.info("HealthViewSet.list() - Insurance service is healthy")
        return Response({'message':'ok'}, status=status.HTTP_200_OK)
