# Local Dev Guide

The PetClinic uses Eureka Services discovery, to test this application locally you need to run Eureka Server, use the following command to run it using docker

```
 docker run -d --publish 8761:8761 public.ecr.aws/o9d5t0i3/eureka-server:latest
```
