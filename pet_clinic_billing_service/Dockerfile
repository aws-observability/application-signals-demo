FROM --platform=linux/amd64 python:3.11
LABEL authors="yagrxu"

WORKDIR /app
RUN pip install --no-cache-dir django djangorestframework boto3 py_eureka_client psycopg2 requests
COPY . /app
EXPOSE 8800
