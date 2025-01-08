#!/bin/sh
set -e

mkdir -p build/python
python3 -m pip install -r function/requirements.txt -t build/python
cp function/lambda_function.py build/python
cd build/python
zip -r ../function.zip ./*

cd ../..
mkdir -p build2/python
python3 -m pip install -r function2/requirements.txt -t build2/python
cp function2/lambda_function.py build2/python
cd build2/python
zip -r ../function.zip ./*

cd ../..
mkdir -p build3/python
python3 -m pip install -r function3/requirements.txt -t build3/python
cp function3/lambda_function.py build3/python
cd build3/python
zip -r ../function.zip ./*

cd ../..
mkdir -p build4/python
python3 -m pip install -r function3/requirements.txt -t build4/python
cp function4/lambda_function.py build4/python
cd build4/python
zip -r ../function.zip ./*