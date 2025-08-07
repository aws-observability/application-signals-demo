from rest_framework import viewsets, status
from rest_framework.response import Response
from django.db.models import Subquery
from .models import Billing,CheckList
from .serializers import BillingSerializer
from opentelemetry import trace
import logging
import boto3
import datetime
import os
import json
import random
import time
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

# Create your views here.

class BillingViewSet(viewsets.ViewSet):
    def list(self, request):
        add_code_location_attributes()
        span = trace.get_current_span()

        # Read all three limits from environment (or use defaults)
        small_limit = int(os.getenv("SMALL_NAME_LIMIT", 100))      # default 100
        medium_limit = int(os.getenv("MEDIUM_NAME_LIMIT", 1_000))   # default 1k
        large_limit = int(os.getenv("LARGE_NAME_LIMIT", 1_000_000))  # default 1M

        # Pick with 1% → large, 10% → medium, otherwise → small
        r = random.random()
        if r < 0.01:
            subquery_limit = large_limit
        elif r < 0.11:
            subquery_limit = medium_limit
        else:
            subquery_limit = small_limit

        invalid_names = CheckList.objects.values('invalid_name').distinct()[:subquery_limit]

        MAX_RESULTS_BOUND = int(os.getenv("MAX_BILLING_RESULTS", 10_000))
        max_results = random.randint(int(MAX_RESULTS_BOUND/10), MAX_RESULTS_BOUND)
        qs = Billing.objects.exclude(
            type_name__in=Subquery(invalid_names)
        )[:max_results]


        # force the DB query and count rows
        db_start = time.time()
        # list(qs) actually hit the database
        objs = list(qs)  
        db_duration_ms = (time.time() - db_start) * 1_000
        record_count = len(objs)
        span.set_attribute("db.subquery_limit", subquery_limit)
        span.set_attribute("db.record_count", record_count)
        span.set_attribute("db.fetch_time_ms", db_duration_ms)

        # measure serialization
        ser_start = time.time()
        serializer = BillingSerializer(objs, many=True)
        ser_duration_ms = (time.time() - ser_start) * 1_000
        span.set_attribute("serialization.time_ms", ser_duration_ms)

        return Response(serializer.data)

    def retrieve(self, request, pk=None, owner_id=None, type=None, pet_id=None):
        add_code_location_attributes()
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
        add_code_location_attributes()
        serializer = BillingSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            self.log(request.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        add_code_location_attributes()
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
        add_code_location_attributes()
        return Response({'message':'ok'}, status=status.HTTP_200_OK)
