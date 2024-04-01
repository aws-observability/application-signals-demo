from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import Billing
from .serializers import BillingSerializer
import logging
import boto3
import os
import json

logger = logging.getLogger(__name__)
# Create your views here.

class BillingViewSet(viewsets.ViewSet):
    # queryset = Billing.objects.all()
    # serializer_class = BillingSerializer
    def list(self, request):
        queryset = Billing.objects.all()
        serializer = BillingSerializer(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None, owner_id=None, type=None, pet_id=None):
        try:
            billing_obj = None
            if pk is not None:
                billing_obj = Billing.objects.get(id=pk)
            else:
                billing_obj = Billing.objects.get(owner_id=owner_id, type=type, pet_id=pet_id)
            serializer = BillingSerializer(billing_obj)
            return Response(serializer.data)
        except Billing.DoesNotExist:
            return Response({'message': 'Billing object not found'}, status=404)

    def create(self, request):
        serializer = BillingSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            self.notify(json.dumps(request.data))
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        try:
            billing_obj = Billing.objects.get(id=pk)
            serializer = BillingSerializer(billing_obj, data=request.data)
            if serializer.is_valid():
                serializer.save()
                self.notify(json.dumps(request.data))
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Billing.DoesNotExist:
            return Response({'message': 'Billing object not found'}, status=status.HTTP_404_NOT_FOUND)

    def notify(self, data):
        sns_client = boto3.client('sns', region_name=os.environ.get('REGION', 'us-east-1'))
        topic_arn = os.environ.get('NOTIFICATION_ARN')

        # Define the message you want to send

        # Publish the message to the SNS topic
        response = sns_client.publish(
            TopicArn=topic_arn,
            Message=data
        )

class HealthViewSet(viewsets.ViewSet):
    def list(self, request):
        # service_name = "insurance-service"
        # eureka_server_url = "http://discovery-server:8761/eureka/"
        # response = requests.get(f"{eureka_server_url}/apps/{service_name}")
        # data = response.json()
        # logger.error(data)
        return Response({'message':'ok'}, status=status.HTTP_200_OK)
