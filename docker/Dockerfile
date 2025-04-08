FROM --platform=linux/amd64 public.ecr.aws/amazoncorretto/amazoncorretto:11 as builder
WORKDIR /application
ARG ARTIFACT_NAME
COPY ${ARTIFACT_NAME}.jar application.jar
RUN java -Djarmode=layertools -jar application.jar extract

# Install wget
RUN yum install -y wget tar gzip && yum clean all

# Download dockerize and cache that layer
ARG DOCKERIZE_VERSION
RUN wget -O dockerize.tar.gz https://github.com/jwilder/dockerize/releases/download/${DOCKERIZE_VERSION}/dockerize-alpine-linux-amd64-${DOCKERIZE_VERSION}.tar.gz
RUN tar xzf dockerize.tar.gz
RUN chmod +x dockerize


FROM public.ecr.aws/amazoncorretto/amazoncorretto:11
USER 1000

WORKDIR /application

# Dockerize
COPY --from=builder /application/dockerize ./

ARG EXPOSED_PORT
EXPOSE ${EXPOSED_PORT}

ENV SPRING_PROFILES_ACTIVE docker

# fix for https://stackoverflow.com/questions/51115856/docker-failed-to-export-image-failed-to-create-image-failed-to-get-layer
# (only last copy caused issue)
# this seems to be triggered by using btrfs:
# https://github.com/moby/moby/issues/36573
RUN true
COPY --from=builder /application/dependencies/ ./
RUN true
COPY --from=builder /application/spring-boot-loader/ ./
RUN true
COPY --from=builder /application/snapshot-dependencies/ ./
RUN true
COPY --from=builder /application/application/ ./
ENTRYPOINT ["java", "org.springframework.boot.loader.JarLauncher"]
