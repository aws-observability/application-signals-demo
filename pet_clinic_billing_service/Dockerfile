FROM --platform=linux/amd64 public.ecr.aws/docker/library/python:3.10

WORKDIR /app
RUN pip install --no-cache-dir django djangorestframework boto3 py_eureka_client psycopg2 requests
COPY . /app
EXPOSE 8800
