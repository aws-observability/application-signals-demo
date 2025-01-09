import os
import requests
import time


def lambda_handler(event, context):
    url1 = os.getenv('API_URL_1')
    url2 = os.getenv('API_URL_2')
    url3 = os.getenv('API_URL_3')

    requests.get(url1)


    if not url2 or not url3:
        return {
            'statusCode': 500,
            'body': 'environment variable is not set'
        }
    status_code = ''
    body = ''
    try:
        for x in range(1):
            response = requests.get(url2)
            status_code = response.status_code
            body = response.text
            body += '\n'


            url31 = url3.replace("dog", "111111111111")
            response = requests.get(url31)
            print(response.text)
            time.sleep(1)

            url37 = url3.replace("dog", "777777777777")
            response = requests.get(url37)
            print(response.text)
            time.sleep(1)


    except requests.exceptions.RequestException as e:
        return {
            'statusCode': 500,
            'body': f'Error calling url: {str(e)}'
        }
    return {
        'statusCode': status_code,
        'body': body
    }
