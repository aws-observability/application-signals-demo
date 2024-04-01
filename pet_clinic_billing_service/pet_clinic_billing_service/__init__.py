import socket
import os
from py_eureka_client import eureka_client

# Get the local IP address
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.connect(("8.8.8.8", 80))
local_ip = s.getsockname()[0]
s.close()

eureka_server_url = os.environ.get('EUREKA_SERVER_URL', 'localhost')
# Register with Eureka
eureka_client.init(
    eureka_server=f"http://{eureka_server_url}:8761/eureka",
    instance_host=local_ip,
    app_name="billing-service",
    instance_port=8800,  # Django's default port
    # ... other configuration options
)
