# Base image
FROM --platform=linux/amd64 amazonlinux:2023

# Install dependencies
RUN yum update -y && \
    yum install -y python3.11 python3.11-pip git jq unzip && \
    yum install -y libXcomposite libXcursor libXdamage libXext libXi libXtst \
                   cups-libs libXScrnSaver libXrandr alsa-lib atk at-spi2-atk \
                   gtk3 libdrm libxkbcommon xorg-x11-fonts-Type1 xorg-x11-fonts-misc && \
    yum clean all

# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && \
    ./aws/install && \
    rm -rf awscliv2.zip aws/

# Install Python packages
RUN python3.11 -m pip install --upgrade pip && \
    python3.11 -m pip install boto3 botocore langchain_aws && \
    python3.11 -m pip install "browser-use[memory]==0.2.5" && \
    python3.11 -m pip install playwright natsort && \
    python3.11 -m playwright install chromium

# Clone repository
ARG REBUILD_CACHE_BUSTER=unspecified
RUN echo "Rebuild timestamp: $REBUILD_CACHE_BUSTER" && \
    rm -rf /app && \
    git clone https://github.com/aws-observability/application-signals-demo.git /app

# Set environment variables
ENV DEFAULT_ACCOUNT_AWS_REGION=<UPDATE>
ENV DEFAULT_AWS_ACCOUNT_ID=<UPDATE>
ENV DEBUG_MODE=<UPDATE>
ENV S3_BUCKET_NAME_PREFIX=<UPDATE>
ENV CLOUDWATCH_NAMESPACE=<UPDATE>
ENV DEMO_AWS_ACCOUNT_ID=<UPDATE>
ENV DEMO_ROLE_ID=<UPDATE>
ENV HEADLESS_MODE=True
ENV MANUAL_MODE=False

WORKDIR /app/ai-validator/libs