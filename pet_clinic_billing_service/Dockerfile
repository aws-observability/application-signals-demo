FROM --platform=linux/amd64 public.ecr.aws/docker/library/python:3.10

WORKDIR /app
RUN mkdir -p /app/tmp && \
    export TMPDIR=/app/tmp && \
    pip install --no-cache-dir django djangorestframework boto3 py_eureka_client psycopg2 requests opentelemetry-api

COPY . /app
EXPOSE 8800
