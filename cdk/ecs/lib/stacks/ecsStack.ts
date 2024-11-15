import { ApplicationTargetGroup } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { CfnOutput, Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Secret as SmSecret } from 'aws-cdk-lib/aws-secretsmanager';
import {
    TaskDefinition,
    Cluster,
    FargateService,
    Compatibility,
    NetworkMode,
    ContainerImage,
    LogDrivers,
    Protocol,
    Secret as EcsSecret,
} from 'aws-cdk-lib/aws-ecs';
import { Vpc, ISubnet, SecurityGroup } from 'aws-cdk-lib/aws-ec2';

import { ServiceDiscoveryStack } from './servicediscoveryStack';
import { LogStack } from './logStack';

interface EcsClusterStackProps extends StackProps {
    readonly vpc: Vpc;
    readonly securityGroups: SecurityGroup[];
    readonly ecsTaskRole: Role;
    readonly ecsTaskExecutionRole: Role;
    readonly subnets: ISubnet[];
    readonly serviceDiscoveryStack: ServiceDiscoveryStack;
    readonly logStack: LogStack;
}

interface CreateServiceProps {
    readonly serviceName: string;
    readonly taskDefinition: TaskDefinition;
}

type MetricTransformationConfig = {
    readonly selectors: Array<{
        readonly dimension: string;
        readonly match: string;
    }>;
    readonly replacements: Array<{
        readonly target_dimension: string;
        readonly value: string;
    }>;
    readonly action: string;
};

export class EcsClusterStack extends Stack {
    public readonly cluster: Cluster;
    private readonly securityGroups: SecurityGroup[];
    private readonly ecsTaskRole: Role;
    private readonly ecsTaskExecutionRole: Role;
    private readonly subnets: ISubnet[];
    private readonly ecrImagePrefix: string;
    private readonly serviceDiscoveryStack: ServiceDiscoveryStack;
    private readonly logStack: LogStack;
    private readonly CLUSTER_NAME = 'ecs-pet-clinic-demo';
    private readonly CONFIG_SERVER = 'pet-clinic-config-server';
    private readonly DISCOVERY_SERVER = 'pet-clinic-discovery-server';
    private readonly ADMIN_SERVER = 'pet-clinic-admin-server';
    private readonly API_GATEWAY = 'pet-clinic-api-gateway';
    private readonly VISITS_SERVICE = 'pet-clinic-visits-service';
    private readonly CUSTOMERS_SERVICE = 'pet-clinic-customers-service';
    private readonly VETS_SERVICE = 'pet-clinic-vets-service';
    private DISCOVERY_SERVER_CW_CONFIG: MetricTransformationConfig;
    private CONFIG_SERVER_CW_CONFIG: MetricTransformationConfig;
    private VISIT_SERVICE_CW_CONFIG: MetricTransformationConfig;
    private VET_SERVICE_CW_CONFIG: MetricTransformationConfig;
    private CUSTOMERS_SERVICE_CW_CONFIG: MetricTransformationConfig;

    constructor(scope: Construct, id: string, props: EcsClusterStackProps) {
        super(scope, id, props);

        this.cluster = new Cluster(this, 'EcsCluster', {
            vpc: props.vpc,
            clusterName: this.CLUSTER_NAME,
        });

        this.ecrImagePrefix = `${this.account}.dkr.ecr.${this.region}.amazonaws.com`; // retrive ECR image from the private repository

        this.securityGroups = props.securityGroups;
        this.ecsTaskRole = props.ecsTaskRole;
        this.ecsTaskExecutionRole = props.ecsTaskExecutionRole;
        this.subnets = props.subnets;
        this.serviceDiscoveryStack = props.serviceDiscoveryStack;
        this.logStack = props.logStack;
        this.replaceRemoteServicesNames();

        new CfnOutput(this, 'EcsClusterArn', { value: this.cluster.clusterArn });
    }

    createService(props: CreateServiceProps) {
        // 1. create service discovery service
        const DNSService = this.serviceDiscoveryStack.createService(props.serviceName);

        // 2, create ECS service
        const ecsService = new FargateService(this, `${props.serviceName}-ecs-service`, {
            serviceName: props.serviceName,
            taskDefinition: props.taskDefinition,
            cluster: this.cluster,
            securityGroups: this.securityGroups,
            vpcSubnets: {
                subnets: this.subnets,
            },
            assignPublicIp: true,
        });

        ecsService.associateCloudMapService({
            service: DNSService,
        });

        new CfnOutput(this, `ecsService-${props.serviceName}`, {
            value: ecsService.serviceName,
        });
        console.log(`Ecs Service - ${props.serviceName} is created`);
    }

    createConfigServer() {
        // Create a log group
        const configLogGroup = this.logStack.createLogGroup(this.CONFIG_SERVER);

        // Create ECS task definition
        const taskDefinition = new TaskDefinition(this, `${this.CONFIG_SERVER}-task`, {
            cpu: '256',
            memoryMiB: '512',
            compatibility: Compatibility.FARGATE,
            family: this.CONFIG_SERVER,
            networkMode: NetworkMode.AWS_VPC,
            taskRole: this.ecsTaskRole,
            executionRole: this.ecsTaskExecutionRole,
        });

        // Add Container to Task Definition
        const container = taskDefinition.addContainer(`${this.CONFIG_SERVER}-container`, {
            image: ContainerImage.fromRegistry(`${this.ecrImagePrefix}/springcommunity/spring-petclinic-config-server`),
            cpu: 256,
            memoryLimitMiB: 512,
            essential: true,
            environment: {
                SPRING_PROFILES_ACTIVE: 'ecs',
            },
            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: configLogGroup,
            }),
        });

        // Add Port Mapping
        container.addPortMappings({
            containerPort: 8888,
            protocol: Protocol.TCP,
        });

        // Create ECS service
        this.createService({
            serviceName: this.CONFIG_SERVER,
            taskDefinition: taskDefinition,
        });
    }

    createDiscoveryServer() {
        // Create a log group
        const discoveryLogGroup = this.logStack.createLogGroup(this.DISCOVERY_SERVER);

        // Create ECS task definition
        const taskDefinition = new TaskDefinition(this, `${this.DISCOVERY_SERVER}-task`, {
            cpu: '256',
            memoryMiB: '512',
            compatibility: Compatibility.FARGATE,
            family: this.DISCOVERY_SERVER,
            networkMode: NetworkMode.AWS_VPC,
            taskRole: this.ecsTaskRole,
            executionRole: this.ecsTaskExecutionRole,
        });

        // Add Container to Task Definition
        const container = taskDefinition.addContainer(`${this.DISCOVERY_SERVER}-container`, {
            image: ContainerImage.fromRegistry(
                `${this.ecrImagePrefix}/springcommunity/spring-petclinic-discovery-server`,
            ),
            cpu: 256,
            memoryLimitMiB: 512,
            essential: true,
            environment: {
                SPRING_PROFILES_ACTIVE: 'ecs',
                CONFIG_SERVER_URL: `http://${this.CONFIG_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8888`,
            },
            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: discoveryLogGroup,
            }),
        });

        // Add Port Mapping
        container.addPortMappings({
            containerPort: 8761,
            protocol: Protocol.TCP,
        });

        // Create ECS service
        this.createService({
            serviceName: this.DISCOVERY_SERVER,
            taskDefinition: taskDefinition,
        });
    }

    createAdminServer() {
        // Create a log group
        const adminLogGroup = this.logStack.createLogGroup(this.ADMIN_SERVER);

        // Create ECS task definition
        const taskDefinition = new TaskDefinition(this, `${this.ADMIN_SERVER}-task`, {
            cpu: '256',
            memoryMiB: '512',
            compatibility: Compatibility.FARGATE,
            family: this.ADMIN_SERVER,
            networkMode: NetworkMode.AWS_VPC,
            taskRole: this.ecsTaskRole,
            executionRole: this.ecsTaskExecutionRole,
        });

        // Add Container to Task Definition
        const container = taskDefinition.addContainer(`${this.ADMIN_SERVER}-container`, {
            image: ContainerImage.fromRegistry(`${this.ecrImagePrefix}/springcommunity/spring-petclinic-admin-server`),
            cpu: 256,
            memoryLimitMiB: 512,
            essential: true,
            environment: {
                SPRING_PROFILES_ACTIVE: 'ecs',
                CONFIG_SERVER_URL: `http://${this.CONFIG_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8888`,
                DISCOVERY_SERVER_URL: `http://${this.DISCOVERY_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8761/eureka`,
                ADMIN_IP: `${this.ADMIN_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
            },
            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: adminLogGroup,
            }),
        });

        // Add Port Mapping
        container.addPortMappings({
            containerPort: 9090,
            protocol: Protocol.TCP,
        });

        // Create ECS service
        this.createService({
            serviceName: this.ADMIN_SERVER,
            taskDefinition: taskDefinition,
        });
    }

    createApiGateway(loadBalancerDNS: string, adotJavaImageTag: string, targetGroup: ApplicationTargetGroup) {
        // Create a log group
        const apiGatewayLogGroup = this.logStack.createLogGroup(this.API_GATEWAY);
        const cwAgentApiGatewayLogGroup = this.logStack.createLogGroup('ecs-cwagent-api-gateway');

        // Create ECS task definition
        const taskDefinition = new TaskDefinition(this, `${this.API_GATEWAY}-task`, {
            cpu: '256',
            memoryMiB: '512',
            compatibility: Compatibility.FARGATE,
            family: this.API_GATEWAY,
            networkMode: NetworkMode.AWS_VPC,
            taskRole: this.ecsTaskRole,
            executionRole: this.ecsTaskExecutionRole,
        });

        // Add volume
        taskDefinition.addVolume({
            name: 'opentelemetry-auto-instrumentation',
        });

        // Add Container to Task Definition
        const mainContainer = taskDefinition.addContainer(`${this.API_GATEWAY}-container`, {
            image: ContainerImage.fromRegistry(`${this.ecrImagePrefix}/springcommunity/spring-petclinic-api-gateway`),
            cpu: 256,
            memoryLimitMiB: 512,
            essential: true,
            environment: {
                OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
                OTEL_LOGS_EXPORTER: 'none',
                OTEL_TRACES_SAMPLER: 'xray',
                OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://localhost:4316/v1/traces',
                OTEL_PROPAGATORS: 'tracecontext,baggage,b3,xray',
                OTEL_RESOURCE_ATTRIBUTES: `aws.log.group.names=${apiGatewayLogGroup.logGroupName},service.name=ecs-petclinic-demo-api-gateway`,
                OTEL_AWS_APPLICATION_SIGNALS_ENABLED: 'true',
                OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT: 'http://localhost:4316/v1/metrics',
                OTEL_METRICS_EXPORTER: 'none',
                JAVA_TOOL_OPTIONS: ' -javaagent:/otel-auto-instrumentation/javaagent.jar',
                SPRING_PROFILES_ACTIVE: 'ecs',
                CONFIG_SERVER_URL: `http://${this.CONFIG_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8888`,
                DISCOVERY_SERVER_URL: `http://${this.DISCOVERY_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8761/eureka`,
                API_GATEWAY_IP: loadBalancerDNS, // use load balancer dns
            },
            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: apiGatewayLogGroup,
            }),
        });

        // Add Port Mapping
        mainContainer.addPortMappings({
            containerPort: 8080,
            protocol: Protocol.TCP,
        });

        mainContainer.addMountPoints({
            sourceVolume: 'opentelemetry-auto-instrumentation',
            containerPath: '/otel-auto-instrumentation',
            readOnly: false,
        });

        // Add init container
        const initContainer = taskDefinition.addContainer('init-api-gateway-container', {
            image: ContainerImage.fromRegistry(
                `public.ecr.aws/aws-observability/adot-autoinstrumentation-java:${adotJavaImageTag}`,
            ),
            essential: false, // The container will stop with exit 0 after it completes.
            command: ['cp', '/javaagent.jar', '/otel-auto-instrumentation/javaagent.jar'],
        });

        initContainer.addMountPoints({
            sourceVolume: 'opentelemetry-auto-instrumentation',
            containerPath: '/otel-auto-instrumentation',
            readOnly: false,
        });

        // Add CloudWatch agent container
        taskDefinition.addContainer('ecs-cwagent-api-gateway-container', {
            image: ContainerImage.fromRegistry('public.ecr.aws/cloudwatch-agent/cloudwatch-agent:latest'),
            memoryLimitMiB: 128,
            essential: true,
            environment: {
                CW_CONFIG_CONTENT: JSON.stringify({
                    traces: {
                        traces_collected: {
                            application_signals: {},
                        },
                    },
                    logs: {
                        metrics_collected: {
                            application_signals: {
                                rules: [
                                    this.DISCOVERY_SERVER_CW_CONFIG,
                                    this.CONFIG_SERVER_CW_CONFIG,
                                    this.CUSTOMERS_SERVICE_CW_CONFIG,
                                    this.VISIT_SERVICE_CW_CONFIG,
                                    this.VET_SERVICE_CW_CONFIG,
                                ],
                            },
                        },
                    },
                }),
            },

            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: cwAgentApiGatewayLogGroup,
            }),
        });

        const service = new FargateService(this, `${this.API_GATEWAY}-ecs-service`, {
            serviceName: this.API_GATEWAY,
            taskDefinition: taskDefinition,
            cluster: this.cluster,
            securityGroups: this.securityGroups,
            vpcSubnets: {
                subnets: this.subnets,
            },
            assignPublicIp: true,
            desiredCount: 1,
        });

        // Add Application Load Balancer target group
        service.attachToApplicationTargetGroup(targetGroup);
    }

    runVetsService(adotJavaImageTag: string) {
        // Create a log group
        const vetsLogGroup = this.logStack.createLogGroup(this.VETS_SERVICE);
        const cwAgentVetsServiceLogGroup = this.logStack.createLogGroup('ecs-cwagent-vets-service');

        // Create ECS task definition
        const taskDefinition = new TaskDefinition(this, `${this.VETS_SERVICE}-task`, {
            cpu: '256',
            memoryMiB: '512',
            compatibility: Compatibility.FARGATE,
            family: this.VETS_SERVICE,
            networkMode: NetworkMode.AWS_VPC,
            taskRole: this.ecsTaskRole,
            executionRole: this.ecsTaskExecutionRole,
        });

        // Add volume
        taskDefinition.addVolume({
            name: 'opentelemetry-auto-instrumentation',
        });

        // Add Container to Task Definition
        const mainContainer = taskDefinition.addContainer(`${this.VETS_SERVICE}-container`, {
            image: ContainerImage.fromRegistry(`${this.ecrImagePrefix}/springcommunity/spring-petclinic-vets-service`),
            cpu: 256,
            memoryLimitMiB: 512,
            essential: true,
            environment: {
                OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
                OTEL_LOGS_EXPORTER: 'none',
                OTEL_TRACES_SAMPLER: 'xray',
                OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://localhost:4316/v1/traces',
                OTEL_PROPAGATORS: 'tracecontext,baggage,b3,xray',
                OTEL_RESOURCE_ATTRIBUTES: `aws.log.group.names=${vetsLogGroup.logGroupName},service.name=${this.VETS_SERVICE}`,
                OTEL_AWS_APPLICATION_SIGNALS_ENABLED: 'true',
                OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT: 'http://localhost:4316/v1/metrics',
                OTEL_METRICS_EXPORTER: 'none',
                JAVA_TOOL_OPTIONS: ' -javaagent:/otel-auto-instrumentation/javaagent.jar',
                SPRING_PROFILES_ACTIVE: 'ecs',
                CONFIG_SERVER_URL: `http://${this.CONFIG_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8888`,
                DISCOVERY_SERVER_URL: `http://${this.DISCOVERY_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8761/eureka`,
                VETS_SERVICE_IP: `${this.VETS_SERVICE}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
            },
            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: vetsLogGroup,
            }),
        });

        // Add Port Mapping
        mainContainer.addPortMappings({
            containerPort: 8083,
            protocol: Protocol.TCP,
        });

        mainContainer.addMountPoints({
            sourceVolume: 'opentelemetry-auto-instrumentation',
            containerPath: '/otel-auto-instrumentation',
            readOnly: false,
        });

        // Add init container
        const initContainer = taskDefinition.addContainer('init-vets-service-container', {
            image: ContainerImage.fromRegistry(
                `public.ecr.aws/aws-observability/adot-autoinstrumentation-java:${adotJavaImageTag}`,
            ),
            essential: false, // The container will stop with exit 0 after it completes.
            command: ['cp', '/javaagent.jar', '/otel-auto-instrumentation/javaagent.jar'],
        });

        initContainer.addMountPoints({
            sourceVolume: 'opentelemetry-auto-instrumentation',
            containerPath: '/otel-auto-instrumentation',
            readOnly: false,
        });

        // Add CloudWatch agent container
        taskDefinition.addContainer('ecs-cwagent-vets-service-container', {
            image: ContainerImage.fromRegistry('public.ecr.aws/cloudwatch-agent/cloudwatch-agent:latest'),
            memoryLimitMiB: 128,
            essential: true,
            environment: {
                CW_CONFIG_CONTENT: JSON.stringify({
                    traces: {
                        traces_collected: {
                            application_signals: {},
                        },
                    },
                    logs: {
                        metrics_collected: {
                            application_signals: {
                                rules: [this.DISCOVERY_SERVER_CW_CONFIG, this.CONFIG_SERVER_CW_CONFIG],
                            },
                        },
                    },
                }),
            },

            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: cwAgentVetsServiceLogGroup,
            }),
        });

        // Create ECS service
        this.createService({
            serviceName: this.VETS_SERVICE,
            taskDefinition: taskDefinition,
        });
    }

    runCustomersService(adotJavaImageTag: string) {
        // Create a log group
        const customersLogGroup = this.logStack.createLogGroup(this.CUSTOMERS_SERVICE);
        const cwAgentCustomersServiceLogGroup = this.logStack.createLogGroup('ecs-cwagent-customers-service');

        // Create ECS task definition
        const taskDefinition = new TaskDefinition(this, `${this.CUSTOMERS_SERVICE}-task`, {
            cpu: '256',
            memoryMiB: '512',
            compatibility: Compatibility.FARGATE,
            family: this.CUSTOMERS_SERVICE,
            networkMode: NetworkMode.AWS_VPC,
            taskRole: this.ecsTaskRole,
            executionRole: this.ecsTaskExecutionRole,
        });

        // Add volume
        taskDefinition.addVolume({
            name: 'opentelemetry-auto-instrumentation',
        });

        // Add Container to Task Definition
        const mainContainer = taskDefinition.addContainer(`${this.CUSTOMERS_SERVICE}-container`, {
            image: ContainerImage.fromRegistry(
                `${this.ecrImagePrefix}/springcommunity/spring-petclinic-customers-service`,
            ),
            cpu: 256,
            memoryLimitMiB: 512,
            essential: true,
            environment: {
                AWS_DEFAULT_REGION: this.region,
                OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
                OTEL_LOGS_EXPORTER: 'none',
                OTEL_TRACES_SAMPLER: 'xray',
                OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://localhost:4316/v1/traces',
                OTEL_PROPAGATORS: 'tracecontext,baggage,b3,xray',
                OTEL_RESOURCE_ATTRIBUTES: `aws.log.group.names=${customersLogGroup.logGroupName},service.name=${this.CUSTOMERS_SERVICE}`,
                OTEL_AWS_APPLICATION_SIGNALS_ENABLED: 'true',
                OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT: 'http://localhost:4316/v1/metrics',
                OTEL_METRICS_EXPORTER: 'none',
                JAVA_TOOL_OPTIONS: ' -javaagent:/otel-auto-instrumentation/javaagent.jar',
                SPRING_PROFILES_ACTIVE: 'ecs',
                CONFIG_SERVER_URL: `http://${this.CONFIG_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8888`,
                DISCOVERY_SERVER_URL: `http://${this.DISCOVERY_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8761/eureka`,
                CUSTOMER_SERVICE_IP: `${this.CUSTOMERS_SERVICE}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
            },
            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: customersLogGroup,
            }),
        });

        // Add Port Mapping
        mainContainer.addPortMappings({
            containerPort: 8081,
            protocol: Protocol.TCP,
        });

        mainContainer.addMountPoints({
            sourceVolume: 'opentelemetry-auto-instrumentation',
            containerPath: '/otel-auto-instrumentation',
            readOnly: false,
        });

        // Add init container
        const initContainer = taskDefinition.addContainer('init-customers-service-container', {
            image: ContainerImage.fromRegistry(
                `public.ecr.aws/aws-observability/adot-autoinstrumentation-java:${adotJavaImageTag}`,
            ),
            essential: false, // The container will stop with exit 0 after it completes.
            command: ['cp', '/javaagent.jar', '/otel-auto-instrumentation/javaagent.jar'],
        });

        initContainer.addMountPoints({
            sourceVolume: 'opentelemetry-auto-instrumentation',
            containerPath: '/otel-auto-instrumentation',
            readOnly: false,
        });

        // Add CloudWatch agent container
        taskDefinition.addContainer('ecs-cwagent-customers-service-container', {
            image: ContainerImage.fromRegistry('public.ecr.aws/cloudwatch-agent/cloudwatch-agent:latest'),
            memoryLimitMiB: 128,
            essential: true,
            environment: {
                CW_CONFIG_CONTENT: JSON.stringify({
                    traces: {
                        traces_collected: {
                            application_signals: {},
                        },
                    },
                    logs: {
                        metrics_collected: {
                            application_signals: {
                                rules: [this.DISCOVERY_SERVER_CW_CONFIG, this.CONFIG_SERVER_CW_CONFIG],
                            },
                        },
                    },
                }),
            },

            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: cwAgentCustomersServiceLogGroup,
            }),
        });

        // Create ECS service
        this.createService({
            serviceName: this.CUSTOMERS_SERVICE,
            taskDefinition: taskDefinition,
        });
    }

    runVisitsService(adotJavaImageTag: string) {
        // Create a log group
        const visitsLogGroup = this.logStack.createLogGroup(this.VISITS_SERVICE);
        const cwAgentVisitsServiceLogGroup = this.logStack.createLogGroup('ecs-cwagent-visits-service');

        // Create ECS task definition
        const taskDefinition = new TaskDefinition(this, `${this.VISITS_SERVICE}-task`, {
            cpu: '256',
            memoryMiB: '512',
            compatibility: Compatibility.FARGATE,
            family: this.VISITS_SERVICE,
            networkMode: NetworkMode.AWS_VPC,
            taskRole: this.ecsTaskRole,
            executionRole: this.ecsTaskExecutionRole,
        });

        // Add volume
        taskDefinition.addVolume({
            name: 'opentelemetry-auto-instrumentation',
        });

        // Add Container to Task Definition
        const mainContainer = taskDefinition.addContainer(`${this.VISITS_SERVICE}-container`, {
            image: ContainerImage.fromRegistry(
                `${this.ecrImagePrefix}/springcommunity/spring-petclinic-visits-service`,
            ),
            cpu: 256,
            memoryLimitMiB: 512,
            essential: true,
            environment: {
                AWS_DEFAULT_REGION: this.region,
                OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
                OTEL_LOGS_EXPORTER: 'none',
                OTEL_TRACES_SAMPLER: 'xray',
                OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://localhost:4316/v1/traces',
                OTEL_PROPAGATORS: 'tracecontext,baggage,b3,xray',
                OTEL_RESOURCE_ATTRIBUTES: `aws.log.group.names=${visitsLogGroup.logGroupName},service.name=${this.VISITS_SERVICE}`,
                OTEL_AWS_APPLICATION_SIGNALS_ENABLED: 'true',
                OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT: 'http://localhost:4316/v1/metrics',
                OTEL_METRICS_EXPORTER: 'none',
                JAVA_TOOL_OPTIONS: ' -javaagent:/otel-auto-instrumentation/javaagent.jar',
                SPRING_PROFILES_ACTIVE: 'ecs',
                CONFIG_SERVER_URL: `http://${this.CONFIG_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8888`,
                DISCOVERY_SERVER_URL: `http://${this.DISCOVERY_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8761/eureka`,
                VISITS_SERVICE_IP: `${this.VISITS_SERVICE}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
            },
            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: visitsLogGroup,
            }),
        });

        // Add Port Mapping
        mainContainer.addPortMappings({
            containerPort: 8082,
            protocol: Protocol.TCP,
        });

        mainContainer.addMountPoints({
            sourceVolume: 'opentelemetry-auto-instrumentation',
            containerPath: '/otel-auto-instrumentation',
            readOnly: false,
        });

        // Add init container
        const initContainer = taskDefinition.addContainer('init-visits-service-container', {
            image: ContainerImage.fromRegistry(
                `public.ecr.aws/aws-observability/adot-autoinstrumentation-java:${adotJavaImageTag}`,
            ),
            essential: false, // The container will stop with exit 0 after it completes.
            command: ['cp', '/javaagent.jar', '/otel-auto-instrumentation/javaagent.jar'],
        });

        initContainer.addMountPoints({
            sourceVolume: 'opentelemetry-auto-instrumentation',
            containerPath: '/otel-auto-instrumentation',
            readOnly: false,
        });

        // Add CloudWatch agent container
        taskDefinition.addContainer('ecs-cwagent-visits-service-container', {
            image: ContainerImage.fromRegistry('public.ecr.aws/cloudwatch-agent/cloudwatch-agent:latest'),
            memoryLimitMiB: 128,
            essential: true,
            environment: {
                CW_CONFIG_CONTENT: JSON.stringify({
                    traces: {
                        traces_collected: {
                            application_signals: {},
                        },
                    },
                    logs: {
                        metrics_collected: {
                            application_signals: {
                                rules: [this.DISCOVERY_SERVER_CW_CONFIG, this.CONFIG_SERVER_CW_CONFIG],
                            },
                        },
                    },
                }),
            },

            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: cwAgentVisitsServiceLogGroup,
            }),
        });

        // Create ECS service
        this.createService({
            serviceName: this.VISITS_SERVICE,
            taskDefinition: taskDefinition,
        });
    }

    runInsuranceService(adotPythonImageTag: string, dbSecret: SmSecret, rds_endpoint: string) {
        const INSURANCE_SERVICE = 'pet-clinic-insurance-service';

        // Create a log group
        const insuranceLogGroup = this.logStack.createLogGroup(INSURANCE_SERVICE);
        const cwAgentInsuranceServiceLogGroup = this.logStack.createLogGroup('ecs-cwagent-insurance-service');

        // Create ECS task definition
        const taskDefinition = new TaskDefinition(this, `${INSURANCE_SERVICE}-task`, {
            cpu: '256',
            memoryMiB: '512',
            compatibility: Compatibility.FARGATE,
            family: INSURANCE_SERVICE,
            networkMode: NetworkMode.AWS_VPC,
            taskRole: this.ecsTaskRole,
            executionRole: this.ecsTaskExecutionRole,
        });

        // Add volume
        taskDefinition.addVolume({
            name: 'opentelemetry-auto-instrumentation-python',
        });

        // Add Container to Task Definition
        const mainContainer = taskDefinition.addContainer(`${INSURANCE_SERVICE}-container`, {
            image: ContainerImage.fromRegistry(`${this.ecrImagePrefix}/python-petclinic-insurance-service`),
            cpu: 256,
            memoryLimitMiB: 512,
            essential: true,
            secrets: {
                DB_USER: EcsSecret.fromSecretsManager(dbSecret, 'username'),
                DB_USER_PASSWORD: EcsSecret.fromSecretsManager(dbSecret, 'password'),
            },
            environment: {
                DB_SECRET_ARN: dbSecret.secretArn,
                DJANGO_SETTINGS_MODULE: 'pet_clinic_insurance_service.settings',
                PYTHONPATH:
                    '/otel-auto-instrumentation-python/opentelemetry/instrumentation/auto_instrumentation:/app:/otel-auto-instrumentation-python',
                OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
                OTEL_TRACES_SAMPLER_ARG: 'endpoint=http://localhost:2000',
                OTEL_LOGS_EXPORTER: 'none',
                OTEL_PYTHON_CONFIGURATOR: 'aws_configurator',
                OTEL_TRACES_SAMPLER: 'xray',
                OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://localhost:4316/v1/traces',
                OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT: 'http://localhost:4316/v1/metrics',
                OTEL_AWS_APPLICATION_SIGNALS_ENABLED: 'true',
                OTEL_RESOURCE_ATTRIBUTES: `service.name=${INSURANCE_SERVICE}`,
                OTEL_METRICS_EXPORTER: 'none',
                OTEL_PYTHON_DISTRO: 'aws_distro',
                EUREKA_SERVER_URL: `${this.DISCOVERY_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
                INSURANCE_SERVICE_IP: `${INSURANCE_SERVICE}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
                DB_NAME: 'postgres',
                DATABASE_PROFILE: 'postgresql',
                DB_SERVICE_HOST: rds_endpoint,
                DB_SERVICE_PORT: '5432',
            },
            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: insuranceLogGroup,
            }),
            command: [
                'sh',
                '-c',
                'python manage.py migrate && python manage.py loaddata initial_data.json && python manage.py runserver 0.0.0.0:8000 --noreload',
            ],
            healthCheck: {
                command: ['CMD-SHELL', 'curl -f http://localhost:8000/insurances/ || exit 1'],
                interval: Duration.seconds(60),
                timeout: Duration.seconds(10),
                retries: 5,
                startPeriod: Duration.seconds(3),
            },
        });

        // Add Port Mapping
        mainContainer.addPortMappings({
            containerPort: 8000,
            protocol: Protocol.TCP,
        });

        mainContainer.addMountPoints({
            sourceVolume: 'opentelemetry-auto-instrumentation-python',
            containerPath: '/otel-auto-instrumentation-python',
            readOnly: false,
        });

        // Add init container
        const initContainer = taskDefinition.addContainer('init-insurance-service-container', {
            image: ContainerImage.fromRegistry(
                `public.ecr.aws/aws-observability/adot-autoinstrumentation-python:${adotPythonImageTag}`,
            ),
            essential: false, // The container will stop with exit 0 after it completes.
            command: ['cp', '-a', '/autoinstrumentation/.', '/otel-auto-instrumentation-python'],
        });

        initContainer.addMountPoints({
            sourceVolume: 'opentelemetry-auto-instrumentation-python',
            containerPath: '/otel-auto-instrumentation-python',
            readOnly: false,
        });

        // Add CloudWatch agent container
        taskDefinition.addContainer('ecs-cwagent-insurance-service-container', {
            image: ContainerImage.fromRegistry('public.ecr.aws/cloudwatch-agent/cloudwatch-agent:latest'),
            memoryLimitMiB: 128,
            essential: true,
            environment: {
                CW_CONFIG_CONTENT: JSON.stringify({
                    traces: {
                        traces_collected: {
                            application_signals: {},
                        },
                    },
                    logs: {
                        metrics_collected: {
                            application_signals: {
                                rules: [this.DISCOVERY_SERVER_CW_CONFIG],
                            },
                        },
                    },
                }),
            },

            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: cwAgentInsuranceServiceLogGroup,
            }),
        });

        // Create ECS service
        this.createService({
            serviceName: INSURANCE_SERVICE,
            taskDefinition: taskDefinition,
        });
    }

    runBillingService(adotPythonImageTag: string, dbSecret: SmSecret, rds_endpoint: string) {
        const BILLING_SERVICE = 'pet-clinic-billing-service';

        // Create a log group
        const billingLogGroup = this.logStack.createLogGroup(BILLING_SERVICE);
        const cwAgentBillingServiceLogGroup = this.logStack.createLogGroup('ecs-cwagent-billing-service');

        // Create ECS task definition
        const taskDefinition = new TaskDefinition(this, `${BILLING_SERVICE}-task`, {
            cpu: '256',
            memoryMiB: '512',
            compatibility: Compatibility.FARGATE,
            family: BILLING_SERVICE,
            networkMode: NetworkMode.AWS_VPC,
            taskRole: this.ecsTaskRole,
            executionRole: this.ecsTaskExecutionRole,
        });

        // Add volume
        taskDefinition.addVolume({
            name: 'opentelemetry-auto-instrumentation-python',
        });

        // Add Container to Task Definition
        const mainContainer = taskDefinition.addContainer(`${BILLING_SERVICE}-container`, {
            image: ContainerImage.fromRegistry(`${this.ecrImagePrefix}/python-petclinic-billing-service`),
            cpu: 256,
            memoryLimitMiB: 512,
            essential: true,
            secrets: {
                DB_USER: EcsSecret.fromSecretsManager(dbSecret, 'username'),
                DB_USER_PASSWORD: EcsSecret.fromSecretsManager(dbSecret, 'password'),
            },
            environment: {
                DB_SECRET_ARN: dbSecret.secretArn,
                DJANGO_SETTINGS_MODULE: 'pet_clinic_billing_service.settings',
                PYTHONPATH:
                    '/otel-auto-instrumentation-python/opentelemetry/instrumentation/auto_instrumentation:/app:/otel-auto-instrumentation-python',
                OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
                OTEL_TRACES_SAMPLER_ARG: 'endpoint=http://localhost:2000',
                OTEL_LOGS_EXPORTER: 'none',
                OTEL_PYTHON_CONFIGURATOR: 'aws_configurator',
                OTEL_TRACES_SAMPLER: 'xray',
                OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://localhost:4316/v1/traces',
                OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT: 'http://localhost:4316/v1/metrics',
                OTEL_AWS_APPLICATION_SIGNALS_ENABLED: 'true',
                OTEL_RESOURCE_ATTRIBUTES: `service.name=${BILLING_SERVICE}`,
                OTEL_METRICS_EXPORTER: 'none',
                OTEL_PYTHON_DISTRO: 'aws_distro',
                // OTEL_PROPAGATORS: 'tracecontext,baggage,b3,xray',
                EUREKA_SERVER_URL: `${this.DISCOVERY_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
                BILLING_SERVICE_IP: `${BILLING_SERVICE}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
                DB_NAME: 'postgres',
                DATABASE_PROFILE: 'postgresql',
                DB_SERVICE_HOST: rds_endpoint,
                DB_SERVICE_PORT: '5432',
            },
            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: billingLogGroup,
            }),
            command: ['sh', '-c', 'python manage.py migrate && python manage.py runserver 0.0.0.0:8800 --noreload'],
            // healthCheck: {
            //     command: ['CMD-SHELL', 'curl -f http://localhost:8000/billing/ || exit 1'],
            //     interval: Duration.seconds(60),
            //     timeout: Duration.seconds(10),
            //     retries: 5,
            //     startPeriod: Duration.seconds(3),
            // },
        });

        // Add Port Mapping
        mainContainer.addPortMappings({
            containerPort: 8800,
            protocol: Protocol.TCP,
        });

        mainContainer.addMountPoints({
            sourceVolume: 'opentelemetry-auto-instrumentation-python',
            containerPath: '/otel-auto-instrumentation-python',
            readOnly: false,
        });

        // Add init container
        const initContainer = taskDefinition.addContainer('init-billing-service-container', {
            image: ContainerImage.fromRegistry(
                `public.ecr.aws/aws-observability/adot-autoinstrumentation-python:${adotPythonImageTag}`,
            ),
            essential: false, // The container will stop with exit 0 after it completes.
            command: ['cp', '-a', '/autoinstrumentation/.', '/otel-auto-instrumentation-python'],
        });

        initContainer.addMountPoints({
            sourceVolume: 'opentelemetry-auto-instrumentation-python',
            containerPath: '/otel-auto-instrumentation-python',
            readOnly: false,
        });

        // Add CloudWatch agent container
        taskDefinition.addContainer('ecs-cwagent-billing-service-container', {
            image: ContainerImage.fromRegistry('public.ecr.aws/cloudwatch-agent/cloudwatch-agent:latest'),
            memoryLimitMiB: 128,
            essential: true,
            environment: {
                CW_CONFIG_CONTENT: JSON.stringify({
                    traces: {
                        traces_collected: {
                            application_signals: {},
                        },
                    },
                    logs: {
                        metrics_collected: {
                            application_signals: {
                                rules: [this.DISCOVERY_SERVER_CW_CONFIG],
                            },
                        },
                    },
                }),
            },

            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: cwAgentBillingServiceLogGroup,
            }),
        });

        // Create ECS service
        this.createService({
            serviceName: BILLING_SERVICE,
            taskDefinition: taskDefinition,
        });
    }

    generateTraffic(loadBalancerDNS: string) {
        const TRAFFIC_GENERATOR = 'traffic-generator';
        const trafficGeneratorLogGroup = this.logStack.createLogGroup(TRAFFIC_GENERATOR);

        // Create ECS task definition
        const taskDefinition = new TaskDefinition(this, `${TRAFFIC_GENERATOR}-task`, {
            cpu: '256',
            memoryMiB: '512',
            compatibility: Compatibility.FARGATE,
            family: TRAFFIC_GENERATOR,
            networkMode: NetworkMode.AWS_VPC,
            taskRole: this.ecsTaskRole,
            executionRole: this.ecsTaskExecutionRole,
        });

        // Add Container to Task Definition
        taskDefinition.addContainer(`${TRAFFIC_GENERATOR}-container`, {
            image: ContainerImage.fromRegistry(`public.ecr.aws/u8q5x3l1/traffic-generator`),
            cpu: 256,
            memoryLimitMiB: 512,
            essential: true,
            environment: {
                URL: `http://${loadBalancerDNS}:80`,
                HIGH_LOAD_MAX: '1600',
                HIGH_LOAD_MIN: '800',
                BURST_DELAY_MAX: '80',
                BURST_DELAY_MIN: '60',
                LOW_LOAD_MAX: '60',
                LOW_LOAD_MIN: '30',
            },
            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: trafficGeneratorLogGroup,
            }),
        });

        new FargateService(this, `${TRAFFIC_GENERATOR}-ecs-service`, {
            serviceName: TRAFFIC_GENERATOR,
            taskDefinition: taskDefinition,
            cluster: this.cluster,
            securityGroups: this.securityGroups,
            vpcSubnets: {
                subnets: this.subnets,
            },
            assignPublicIp: true,
            desiredCount: 1,
        });
    }

    replaceRemoteServicesNames() {
        this.DISCOVERY_SERVER_CW_CONFIG = {
            selectors: [
                {
                    dimension: 'RemoteService',
                    match: `${this.DISCOVERY_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}*`,
                },
            ],
            replacements: [
                {
                    target_dimension: 'RemoteService',
                    value: `${this.DISCOVERY_SERVER}`,
                },
            ],
            action: 'replace',
        };

        this.CONFIG_SERVER_CW_CONFIG = {
            selectors: [
                {
                    dimension: 'RemoteService',
                    match: `${this.CONFIG_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}*`,
                },
            ],
            replacements: [
                {
                    target_dimension: 'RemoteService',
                    value: `${this.CONFIG_SERVER}`,
                },
            ],
            action: 'replace',
        };

        this.VET_SERVICE_CW_CONFIG = {
            selectors: [
                {
                    dimension: 'RemoteService',
                    match: `${this.VETS_SERVICE}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}*`,
                },
            ],
            replacements: [
                {
                    target_dimension: 'RemoteService',
                    value: `${this.VETS_SERVICE}`,
                },
            ],
            action: 'replace',
        };

        this.VISIT_SERVICE_CW_CONFIG = {
            selectors: [
                {
                    dimension: 'RemoteService',
                    match: `${this.VISITS_SERVICE}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}*`,
                },
            ],
            replacements: [
                {
                    target_dimension: 'RemoteService',
                    value: `${this.VISITS_SERVICE}`,
                },
            ],
            action: 'replace',
        };

        this.CUSTOMERS_SERVICE_CW_CONFIG = {
            selectors: [
                {
                    dimension: 'RemoteService',
                    match: `${this.CUSTOMERS_SERVICE}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}*`,
                },
            ],
            replacements: [
                {
                    target_dimension: 'RemoteService',
                    value: `${this.CUSTOMERS_SERVICE}`,
                },
            ],
            action: 'replace',
        };
    }
}
