FROM public.ecr.aws/amazoncorretto/amazoncorretto:11 as builder
WORKDIR /application
ARG ARTIFACT_NAME
COPY ${ARTIFACT_NAME}.jar application.jar
RUN java -Djarmode=layertools -jar application.jar extract

# Install wget
RUN yum install -y wget tar gzip && yum clean all

# Download dockerize and cache that layer
ARG DOCKERIZE_VERSION
ARG TARGETPLATFORM
RUN if [ "$TARGETPLATFORM" = "linux/arm64" ]; then \
        wget -O dockerize.tar.gz https://github.com/jwilder/dockerize/releases/download/${DOCKERIZE_VERSION}/dockerize-alpine-linux-arm64-${DOCKERIZE_VERSION}.tar.gz; \
    else \
        wget -O dockerize.tar.gz https://github.com/jwilder/dockerize/releases/download/${DOCKERIZE_VERSION}/dockerize-alpine-linux-amd64-${DOCKERIZE_VERSION}.tar.gz; \
    fi
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

COPY --from=builder /application/dependencies/ ./
COPY --from=builder /application/spring-boot-loader/ ./
COPY --from=builder /application/snapshot-dependencies/ ./
COPY --from=builder /application/application/ ./
ENTRYPOINT ["java", "org.springframework.boot.loader.JarLauncher"]
