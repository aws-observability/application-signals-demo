FROM --platform=linux/amd64 python:3.10
LABEL authors="yagrxu"

WORKDIR /app
RUN pip install --no-cache-dir django djangorestframework boto3 py_eureka_client psycopg2 requests aws-opentelemetry-distro
COPY . /app
EXPOSE 8800
