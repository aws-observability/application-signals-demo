from rest_framework import viewsets, status
from rest_framework.response import Response
from .models import Billing
from .serializers import BillingSerializer
import logging
import boto3
import datetime
import os
import json

logger = logging.getLogger(__name__)
# Create your views here.

class BillingViewSet(viewsets.ViewSet):
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
            self.log(request.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        try:
            billing_obj = Billing.objects.get(id=pk)
            serializer = BillingSerializer(billing_obj, data=request.data)
            if serializer.is_valid():
                serializer.save()
                self.log(request.data)
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Billing.DoesNotExist:
            return Response({'message': 'Billing object not found'}, status=status.HTTP_404_NOT_FOUND)

    def log(self, data):
        # Initialize a DynamoDB client
        client = boto3.client('dynamodb', region_name=os.environ.get('REGION', 'us-east-1'))

        # Define the table name
        table_name = 'BillingInfo'
        current_time = datetime.datetime.now()
        formatted_time = current_time.strftime("%Y-%m-%d %H:%M:%S")
        # Define the item you want to add
        item = {
            'ownerId': {'S': data['owner_id']},
            'timestamp': {'S': formatted_time},
            'billing': {'S': json.dumps(data)},
            # Add more attributes as needed
        }

        # Add the item to the table
        response = client.put_item(
            TableName=table_name,
            Item=item
        )


class HealthViewSet(viewsets.ViewSet):
    def list(self, request):
        return Response({'message':'ok'}, status=status.HTTP_200_OK)
