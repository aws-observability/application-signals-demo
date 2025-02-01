# Base image
FROM --platform=linux/amd64 public.ecr.aws/docker/library/python:3.10

# Define the build argument with a default value
ARG REGION=us-east-1

# Export the ARG to ENV to make it persist
ENV REGION=${REGION}

WORKDIR /

# Debug: Print the REGION to verify it is set
RUN echo "Build-time REGION=${REGION}"

# Copy the built collector binary
COPY otelcol-dev/otelcol-dev /otelcol

# Copy the configuration file
COPY customconfig.yaml /config.yaml

# Update the configuration file dynamically with the region
RUN sed -i "s/region: \".*\"/region: \"${REGION}\"/g" /config.yaml && \
    sed -i "s|https://xray\..*\.amazonaws\.com|https://xray.${REGION}.amazonaws.com|g" /config.yaml

# Debug: Verify the configuration file content
RUN cat /config.yaml

# Ensure the collector binary exists and is executable
RUN ls -lah /otelcol && chmod +x /otelcol

# Expose ports for gRPC and HTTP
EXPOSE 4317 4318

# Entry point for the collector
ENTRYPOINT ["/otelcol"]
CMD ["--config=/config.yaml"]
