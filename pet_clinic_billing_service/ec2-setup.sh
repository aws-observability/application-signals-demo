#!/bin/bash
psql_pass=$1
private_setup_ip_address=$2

sudo yum install python3.9-pip python3.9-devel postgresql15 postgresql-devel gcc* tmux -y

# get rds endpoint
rds_endpoint=`aws rds describe-db-instances --db-instance-identifier petclinic-python --query "DBInstances[*].Endpoint.Address"`
rds_endpoint=`echo $rds_endpoint | cut -d "\"" -f2 | cut -d "\"" -f1`

export DJANGO_SETTINGS_MODULE=pet_clinic_billing_service.settings
export DB_NAME=postgres
export DB_USER=djangouser
export DB_USER_PASSWORD=$psql_pass
export DATABASE_PROFILE=postgresql
export DB_SERVICE_HOST=$rds_endpoint
export DB_SERVICE_PORT=5432
export EUREKA_SERVER_URL=$private_setup_ip_address

pip install -r requirements.txt