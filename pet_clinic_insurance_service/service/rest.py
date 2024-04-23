from py_eureka_client import eureka_client
import requests
import logging
import json

logger = logging.getLogger(__name__)

def resolve_service_url(service_name):
    client = eureka_client.get_client()
    instances = client.applications.get_application(service_name.upper()).instances
    logger.error(instances)
    if len(instances) > 0:
        instance = instances[0]
        return 'http://' + instance.ipAddr + ":" + str(instance.port.port) + "/"
    else:
        raise ValueError("no valid instance found for service '%s'", service_name)

def get_owner_info(owner_id):
    server_url = resolve_service_url("customers-service")
    response = requests.get(server_url + "owner/" + str(owner_id) + "")
    logger.error(server_url + "owner/" + str(owner_id) + "", response.status_code)
    data = json.loads(response.text)
    logger.error(data)
    return data

def create_billings(url, data):
    logger.error(data)
    response = requests.post(url, data)
    logger.error(url + " - " +  str(response.status_code))
def update_billings(url, data):
    logger.error(data)
    response = requests.put(url, data)
    logger.error(url + " - " +  str(response.status_code))

def generate_billings(pet_insurance, owner_id, type, type_name):
    server_url = resolve_service_url("billing-service")
    pet_id = pet_insurance["pet_id"]
    url = f"{server_url}billings/{owner_id}/{pet_id}/{type}/"
    response = requests.get(url)
    logger.error(url + " - " + str(response.status_code))
    if response.status_code != 200 :
        logger.error("create")
        create_billings(server_url + "billings/", {
            "owner_id": owner_id,
            "type": type,
            "type_name": type_name,
            "pet_id": pet_id,
            "payment": pet_insurance["price"],
            "status": "open"
        })
    else:
        logger.error("update")
        data = json.loads(response.text)
        data['payment'] = pet_insurance["price"]
        update_billings(server_url + "billings/" + str(data['id']) + "/", data)

