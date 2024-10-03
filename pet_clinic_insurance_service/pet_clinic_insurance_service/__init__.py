import socket
from py_eureka_client import eureka_client
import os

# Get the local IP address
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.connect(("8.8.8.8", 80))
local_ip = s.getsockname()[0]
s.close()
insurance_service_ip = os.environ.get('INSURANCE_SERVICE_IP', local_ip)

eureka_server_url = os.environ.get('EUREKA_SERVER_URL', 'localhost')
# Register with Eureka
eureka_client.init(
    eureka_server=f"http://{eureka_server_url}:8761/eureka",
    instance_host=insurance_service_ip,
    app_name="insurance-service",
    instance_port=8000,  # Django's default port
    # ... other configuration options
)
