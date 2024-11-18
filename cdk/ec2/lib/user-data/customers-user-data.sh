#!/bin/bash

# Install necessary packages
# retry due to the error like this: "RPM: error: can't create transaction lock on /var/lib/rpm/.rpm.lock (Resource temporarily unavailable)"
# sometime the ec2 instances are launched too fast that when the script runs something is not really ready
# see https://repost.aws/questions/QU_tj7NQl6ReKoG53zzEqYOw/amazon-linux-2023-issue-with-installing-packages-with-cloud-init
max_attempts=5
attempt_num=1
success=false
while [ $success = false ] && [ $attempt_num -le $max_attempts ]; do
  echo "Trying yum install"
  yum update -y
  yum install -y java-17-amazon-corretto-devel git tmux wget jq
  # Check the exit code of the command
  if [ $? -eq 0 ]; then
    echo "Yum install succeeded"
    success=true
  else
    echo "Attempt $attempt_num failed. Sleeping for 3 seconds and trying again..."
    sleep 3
    ((attempt_num++))
  fi
done

# Install CloudWatch Agent
wget https://amazoncloudwatch-agent.s3.amazonaws.com/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
sudo rpm -U ./amazon-cloudwatch-agent.rpm

# Create CloudWatch Agent configuration file
cat <<'EOC' > /amazon-cloudwatch-agent.json
{
  "traces": {
    "traces_collected": {
      "application_signals": {}
    }
  },
  "logs": {
    "metrics_collected": {
      "application_signals": {
        "rules":[
               {
                  "selectors":[
                     {
                        "dimension":"RemoteOperation",
                        "match":"GET /pet-insurances"
                     }
                  ],
                  "replacements":[
                     {
                        "target_dimension":"RemoteService",
                        "value":"insurance-service-ec2-python"
                     }
                  ],
                  "action":"replace"
               },
               {
                  "selectors":[
                     {
                        "dimension":"RemoteService",
                        "match":"169.254.169.254*"
                     }
                  ],
                  "action":"drop"
               }
            ]
      }
    }
  }
}
EOC

# Start CloudWatch Agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s \
  -c file:/amazon-cloudwatch-agent.json

# Switch to ec2-user to run commands
sudo -iu ec2-user bash <<'EOF'
set -x
# Set home directory
cd ~

# Clone the application repository
git clone --branch cdk-setup https://github.com/pxaws/application-signals-demo.git
cd application-signals-demo/

# Build the customers application
./mvnw clean install -pl spring-petclinic-customers-service -am -DskipTests

# Download the AWS OpenTelemetry Java Agent
wget https://github.com/aws-observability/aws-otel-java-instrumentation/releases/download/v1.32.5/aws-opentelemetry-agent.jar -O aws-opentelemetry-agent.jar

# Function to wait for a URL to become accessible
wait_for_url() {
  local url=$1
  echo "Waiting for $url to be accessible..."
  until curl --silent --head --fail "$url"; do
    echo "$url is not accessible. Retrying in 10 seconds..."
    sleep 10
  done
  echo "$url is now accessible"
}

# Wait for config and discovery server to be ready
wait_for_url "http://setup.demo.local:8888"
wait_for_url "http://setup.demo.local:8761"


service_name="customers-service-ec2-java"

# Start the application in a tmux session
tmux start-server
sleep 10
tmux new-session -s customers -d
tmux send-keys -t customers "cd spring-petclinic-customers-service/target/" C-m
tmux send-keys -t customers "export CONFIG_SERVER_URL=http://setup.demo.local:8888" C-m
tmux send-keys -t customers "export DISCOVERY_SERVER_URL=http://setup.demo.local:8761/eureka" C-m
tmux send-keys -t customers "export JAVA_TOOL_OPTIONS=' -javaagent:/home/ec2-user/application-signals-demo/aws-opentelemetry-agent.jar'" C-m
tmux send-keys -t customers "export OTEL_METRICS_EXPORTER=none" C-m
tmux send-keys -t customers "export OTEL_LOGS_EXPORTER=none" C-m
tmux send-keys -t customers "export OTEL_AWS_APPLICATION_SIGNALS_ENABLED=true" C-m
tmux send-keys -t customers "export OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT=http://localhost:4316/v1/metrics" C-m
tmux send-keys -t customers "export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf" C-m
tmux send-keys -t customers "export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4316/v1/traces" C-m
tmux send-keys -t customers "export OTEL_RESOURCE_ATTRIBUTES=\"service.name=${service_name}\"" C-m
tmux send-keys -t customers "export SPRING_PROFILES_ACTIVE=ec2" C-m
tmux send-keys -t customers "java -jar spring-petclinic-customer*.jar" C-m
EOF