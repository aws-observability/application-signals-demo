from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import Insurance, PetInsurance
from .serializers import InsuranceSerializer, PetInsuranceSerializer
from .rest import generate_billings
from opentelemetry import trace
import logging
import os
import inspect

logger = logging.getLogger(__name__)

# Utility function to add code location attributes to the current span
def add_code_location_attributes():
    span = trace.get_current_span()
    if span:
        # Get caller information from the stack
        frame = inspect.currentframe()
        if frame and frame.f_back:
            caller_frame = frame.f_back
            file_name = os.path.basename(caller_frame.f_code.co_filename)
            line_number = caller_frame.f_lineno
            function_name = f"{caller_frame.f_code.co_name}"
            
            span.set_attribute("code.file.path", file_name)
            span.set_attribute("code.line.number", line_number)
            span.set_attribute("code.function.name", function_name)

class InsuranceViewSet(viewsets.ModelViewSet):
    queryset = Insurance.objects.all()
    serializer_class = InsuranceSerializer

    def list(self, request, *args, **kwargs):
        add_code_location_attributes()
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        add_code_location_attributes()
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        add_code_location_attributes()
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        add_code_location_attributes()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        add_code_location_attributes()
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        add_code_location_attributes()
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        queryset = super().get_queryset()
        if not queryset:
            return []  # Return an empty list if the queryset is empty
        return queryset


class PetInsuranceViewSet(viewsets.ModelViewSet):
    queryset = PetInsurance.objects.all()
    serializer_class = PetInsuranceSerializer
    lookup_field = 'pet_id'

    def list(self, request, *args, **kwargs):
        add_code_location_attributes()
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        add_code_location_attributes()
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        add_code_location_attributes()
        serializer = self.get_serializer(data=request.data)
        owner_id = request.data.get('owner_id')
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer, owner_id)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        add_code_location_attributes()
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        owner_id = request.data.get('owner_id')

        if serializer.is_valid():
            self.perform_update(serializer, owner_id)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def partial_update(self, request, *args, **kwargs):
        add_code_location_attributes()
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        add_code_location_attributes()
        return super().destroy(request, *args, **kwargs)

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
        add_code_location_attributes()
        return Response({'message':'ok'}, status=status.HTTP_200_OK)
