#!/bin/bash
psql_pass=$1
private_setup_ip_address=$2
HOST_ENV=$3
SVC_NAME=$4

sudo yum install python3.9-pip python3.9-devel postgresql15 postgresql-devel gcc* tmux -y

# get rds endpoint
rds_endpoint=`aws rds describe-db-instances --db-instance-identifier petclinic-python --query "DBInstances[*].Endpoint.Address" --output text`

PGPASSWORD=$psql_pass createuser djangouser -h $rds_endpoint -U root

PGPASSWORD=$psql_pass psql -h $rds_endpoint -U root -d postgres -c "alter user djangouser with encrypted password '$psql_pass';"
PGPASSWORD=$psql_pass psql -h $rds_endpoint -U root -d postgres -c "grant all privileges on database postgres to djangouser;"
PGPASSWORD=$psql_pass psql -h $rds_endpoint -U root -d postgres -c "ALTER DATABASE postgres OWNER TO djangouser;"

export DJANGO_SETTINGS_MODULE=pet_clinic_insurance_service.settings
export DB_NAME=postgres
export DB_USER=djangouser
export DB_USER_PASSWORD=$psql_pass
export DATABASE_PROFILE=postgresql
export DB_SERVICE_HOST=$rds_endpoint
export DB_SERVICE_PORT=5432
export EUREKA_SERVER_URL=$private_setup_ip_address

pip install -r requirements.txt

pip install aws-opentelemetry-distro
export OTEL_METRICS_EXPORTER=none
export OTEL_LOGS_EXPORTER=none
export OTEL_AWS_APP_SIGNALS_ENABLED=true 
export OTEL_PYTHON_DISTRO=aws_distro 
export OTEL_PYTHON_CONFIGURATOR=aws_configurator 
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf 
export OTEL_TRACES_SAMPLER=xray 
export OTEL_TRACES_SAMPLER_ARG="endpoint=http://localhost:2000" 
export OTEL_AWS_APP_SIGNALS_EXPORTER_ENDPOINT=http://localhost:4316/v1/metrics 
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4316/v1/traces 
export OTEL_RESOURCE_ATTRIBUTES="aws.hostedin.environment=$HOST_ENV,service.name=$SVC_NAME"

python3 manage.py migrate  
python3 manage.py loaddata initial_data.json
opentelemetry-instrument python3 manage.py runserver 0.0.0.0:8000 --noreload