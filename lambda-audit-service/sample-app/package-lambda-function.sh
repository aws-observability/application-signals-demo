#!/bin/sh
set -e

# Create separate directories
mkdir -p build/python-good build/python-deployment

# Install dependencies for good version
python3 -m pip install -r function/requirements.txt -t build/python-good
cp function/lambda_function.py build/python-good
cd build/python-good
zip -r ../good_function.zip ./*
cd ../..

# Install dependencies for bad version  
python3 -m pip install -r function/requirements.txt -t build/python-deployment
cp function/lambda_audit_deployment_function.py build/python-deployment/lambda_function.py
cd build/python-deployment
zip -r ../deployment_function.zip ./*