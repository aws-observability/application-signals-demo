#!/usr/bin/env bash
set -x

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
      "application_signals": {}
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
git clone https://github.com/aws-observability/application-signals-demo.git
cd application-signals-demo/

# Build the Config Server and Discovery Server
./mvnw clean install -DskipTests

# Start the Config Server in a tmux session
tmux start-server
sleep 10
tmux new-session -d -s config-server
tmux send-keys -t config-server 'cd spring-petclinic-config-server/target/' C-m
tmux send-keys -t config-server 'java -jar spring-petclinic-config-server-*.jar' C-m

# Wait for Config Server to start
sleep 20

# Start the Discovery Server in a tmux session
tmux new-session -d -s discovery-server
tmux send-keys -t discovery-server 'cd spring-petclinic-discovery-server/target/' C-m
tmux send-keys -t discovery-server 'java -jar spring-petclinic-discovery-server-*.jar' C-m

# Wait for Config Server to start
sleep 20

# Start the Admin Server in a tmux session
tmux new -s admin -d
tmux send-keys -t admin 'cd spring-petclinic-admin-server/target/' C-m
tmux send-keys -t admin 'java -jar spring-petclinic-admin-server*.jar' C-m
EOF