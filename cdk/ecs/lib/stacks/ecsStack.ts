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
    HealthCheck,
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
    readonly adotJavaImageTag: string;
    readonly adotPythonImageTag: string;
    readonly dbSecret: SmSecret;
    readonly dbInstanceEndpointAddress: string;
    readonly loadBalancerDnsName: string;
    readonly loadBalancerTargetGroup: ApplicationTargetGroup;
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
    private readonly adotJavaImageTag: string;
    private readonly adotPythonImageTag: string;
    private readonly dbSecret: SmSecret;
    private readonly dbInstanceEndpointAddress: string;
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
    private VISITS_SERVICE_CW_CONFIG: MetricTransformationConfig;
    private VETS_SERVICE_CW_CONFIG: MetricTransformationConfig;
    private CUSTOMERS_SERVICE_CW_CONFIG: MetricTransformationConfig;

    constructor(scope: Construct, id: string, props: EcsClusterStackProps) {
        super(scope, id, props);

        this.cluster = new Cluster(this, 'EcsCluster', {
            vpc: props.vpc,
            clusterName: this.CLUSTER_NAME,
        });

        this.ecrImagePrefix = `${this.account}.dkr.ecr.${this.region}.amazonaws.com`; // retrive ECR image from the private repository
        this.adotJavaImageTag = props.adotJavaImageTag;
        this.adotPythonImageTag = props.adotPythonImageTag;
        this.dbSecret = props.dbSecret;
        this.dbInstanceEndpointAddress = props.dbInstanceEndpointAddress;
        this.securityGroups = props.securityGroups;
        this.ecsTaskRole = props.ecsTaskRole;
        this.ecsTaskExecutionRole = props.ecsTaskExecutionRole;
        this.subnets = props.subnets;
        this.serviceDiscoveryStack = props.serviceDiscoveryStack;
        this.logStack = props.logStack;

        this.replaceRemoteServicesNames();

        // Create Config, Discovery and Admin servers
        this.createConfigServer();
        this.createDiscoveryServer();
        this.createAdminServer();

        // Create microservices
        this.runVetsService();
        this.runCustomersService();
        this.runVisitsService();
        this.runInsuranceService();
        this.runBillingService();

        // Create pet clinic frontend
        this.createPetClinicFrontend(props.loadBalancerDnsName, props.loadBalancerTargetGroup);

        // Generate traffic
        this.generateTraffic(props.loadBalancerDnsName);

        new CfnOutput(this, 'EcsClusterArn', { value: this.cluster.clusterArn });
    }

    createConfigServer() {
        const configServerConfig = JSON.stringify({
            image: 'spring-petclinic-config-server',
            port: 8888,
            environmentArgs: {},
        });
        const taskDefinition = this.createServerTaskDefinition(this.CONFIG_SERVER, configServerConfig);

        // Create ECS service
        this.createService({
            serviceName: this.CONFIG_SERVER,
            taskDefinition: taskDefinition,
        });
    }

    createDiscoveryServer() {
        const discoveryServerConfig = JSON.stringify({
            image: 'spring-petclinic-discovery-server',
            port: 8761,
            environmentArgs: {
                CONFIG_SERVER_URL: `http://${this.CONFIG_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8888`,
            },
        });

        const taskDefinition = this.createServerTaskDefinition(this.DISCOVERY_SERVER, discoveryServerConfig);

        // Create ECS service
        this.createService({
            serviceName: this.DISCOVERY_SERVER,
            taskDefinition: taskDefinition,
        });
    }

    createAdminServer() {
        const adminServerConfig = JSON.stringify({
            image: 'spring-petclinic-admin-server',
            port: 9090,
            environmentArgs: {
                CONFIG_SERVER_URL: `http://${this.CONFIG_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8888`,
                DISCOVERY_SERVER_URL: `http://${this.DISCOVERY_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8761/eureka`,
                ADMIN_IP: `${this.ADMIN_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
            },
        });

        const taskDefinition = this.createServerTaskDefinition(this.ADMIN_SERVER, adminServerConfig);

        // Create ECS service
        this.createService({
            serviceName: this.ADMIN_SERVER,
            taskDefinition: taskDefinition,
        });
    }

    createPetClinicFrontend(loadBalancerDNS: string, targetGroup: ApplicationTargetGroup) {
        const frontendConfig: string = JSON.stringify({
            image: 'spring-petclinic-api-gateway',
            environmentArgs: {
                CONFIG_SERVER_URL: `http://${this.CONFIG_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8888`,
                DISCOVERY_SERVER_URL: `http://${this.DISCOVERY_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8761/eureka`,
                API_GATEWAY_IP: loadBalancerDNS,
            },
            port: 8080,
            rules: [
                this.DISCOVERY_SERVER_CW_CONFIG,
                this.CONFIG_SERVER_CW_CONFIG,
                this.CUSTOMERS_SERVICE_CW_CONFIG,
                this.VISITS_SERVICE_CW_CONFIG,
                this.VETS_SERVICE_CW_CONFIG,
            ],
        });

        const taskDefinition = this.createJavaTaskDefinition(this.API_GATEWAY, frontendConfig);

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

    runVetsService() {
        const vetsConfig: string = JSON.stringify({
            image: 'spring-petclinic-vets-service',
            environmentArgs: {
                CONFIG_SERVER_URL: `http://${this.CONFIG_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8888`,
                DISCOVERY_SERVER_URL: `http://${this.DISCOVERY_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8761/eureka`,
                VETS_SERVICE_IP: `${this.VETS_SERVICE}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
            },
            port: 8083,
            rules: [this.DISCOVERY_SERVER_CW_CONFIG, this.CONFIG_SERVER_CW_CONFIG],
        });

        const taskDefinition = this.createJavaTaskDefinition(this.VETS_SERVICE, vetsConfig);

        // Create ECS service
        this.createService({
            serviceName: this.VETS_SERVICE,
            taskDefinition: taskDefinition,
        });
    }

    runCustomersService() {
        const customersConfig: string = JSON.stringify({
            image: 'spring-petclinic-customers-service',
            environmentArgs: {
                REGION_FROM_ECS: this.region,
                CONFIG_SERVER_URL: `http://${this.CONFIG_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8888`,
                DISCOVERY_SERVER_URL: `http://${this.DISCOVERY_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8761/eureka`,
                CUSTOMER_SERVICE_IP: `${this.CUSTOMERS_SERVICE}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
            },
            port: 8081,
            rules: [this.DISCOVERY_SERVER_CW_CONFIG, this.CONFIG_SERVER_CW_CONFIG],
        });

        const taskDefinition = this.createJavaTaskDefinition(this.CUSTOMERS_SERVICE, customersConfig);

        // Create ECS service
        this.createService({
            serviceName: this.CUSTOMERS_SERVICE,
            taskDefinition: taskDefinition,
        });
    }

    runVisitsService() {
        const visitsConfig: string = JSON.stringify({
            image: 'spring-petclinic-visits-service',
            environmentArgs: {
                REGION_FROM_ECS: this.region,
                CONFIG_SERVER_URL: `http://${this.CONFIG_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8888`,
                DISCOVERY_SERVER_URL: `http://${this.DISCOVERY_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}:8761/eureka`,
                VISITS_SERVICE_IP: `${this.VISITS_SERVICE}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
            },
            port: 8082,
            rules: [this.DISCOVERY_SERVER_CW_CONFIG, this.CONFIG_SERVER_CW_CONFIG],
        });

        const taskDefinition = this.createJavaTaskDefinition(this.VISITS_SERVICE, visitsConfig);

        // Create ECS service
        this.createService({
            serviceName: this.VISITS_SERVICE,
            taskDefinition: taskDefinition,
        });
    }

    runInsuranceService() {
        const INSURANCE_SERVICE = 'pet-clinic-insurance-service';

        const insuranceConfig = JSON.stringify({
            port: 8000,
            image: 'python-petclinic-insurance-service',
            environmentArgs: {
                INSURANCE_SERVICE_IP: `${INSURANCE_SERVICE}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
                DJANGO_SETTINGS_MODULE: 'pet_clinic_insurance_service.settings',
            },
            command: [
                'sh',
                '-c',
                'python manage.py migrate && python manage.py loaddata initial_data.json && python manage.py runserver 0.0.0.0:8000 --noreload',
            ],
            rules: [this.DISCOVERY_SERVER_CW_CONFIG],
        });

        const healthCheck: HealthCheck = {
            command: ['CMD-SHELL', 'curl -f http://localhost:8000/insurances/ || exit 1'],
            interval: Duration.seconds(60),
            timeout: Duration.seconds(10),
            retries: 5,
            startPeriod: Duration.seconds(3),
        };

        const taskDefinition = this.createPythonTaskDefinition(INSURANCE_SERVICE, insuranceConfig, healthCheck);

        // Create ECS service
        this.createService({
            serviceName: INSURANCE_SERVICE,
            taskDefinition: taskDefinition,
        });
    }

    runBillingService() {
        const BILLING_SERVICE = 'pet-clinic-billing-service';

        const billingConfig = JSON.stringify({
            port: 8800,
            image: 'python-petclinic-billing-service',
            environmentArgs: {
                DJANGO_SETTINGS_MODULE: 'pet_clinic_billing_service.settings',
                BILLING_SERVICE_IP: `${BILLING_SERVICE}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
            },
            rules: [this.DISCOVERY_SERVER_CW_CONFIG],
            command: ['sh', '-c', 'python manage.py migrate && python manage.py runserver 0.0.0.0:8800 --noreload'],
        });

        const taskDefinition = this.createPythonTaskDefinition(BILLING_SERVICE, billingConfig);

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

        this.VETS_SERVICE_CW_CONFIG = {
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

        this.VISITS_SERVICE_CW_CONFIG = {
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

    createJavaTaskDefinition(serviceName: string, config: string) {
        const { image, environmentArgs, port, rules } = JSON.parse(config);

        const logGroup = this.logStack.createLogGroup(serviceName);
        const cwAgentLogGroup = this.logStack.createLogGroup(`${serviceName}-cwagent`);

        // Create ECS task definition
        const taskDefinition = new TaskDefinition(this, `${serviceName}-task`, {
            cpu: '256',
            memoryMiB: '512',
            compatibility: Compatibility.FARGATE,
            family: serviceName,
            networkMode: NetworkMode.AWS_VPC,
            taskRole: this.ecsTaskRole,
            executionRole: this.ecsTaskExecutionRole,
        });

        taskDefinition.addVolume({
            name: 'opentelemetry-auto-instrumentation',
        });

        // Add Container to Task Definition
        const mainContainer = taskDefinition.addContainer(`${serviceName}-container`, {
            image: ContainerImage.fromRegistry(`${this.ecrImagePrefix}/springcommunity/${image}`),
            cpu: 256,
            memoryLimitMiB: 512,
            essential: true,
            environment: {
                OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
                OTEL_LOGS_EXPORTER: 'none',
                OTEL_TRACES_SAMPLER: 'xray',
                OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://localhost:4316/v1/traces',
                OTEL_PROPAGATORS: 'tracecontext,baggage,b3,xray',
                OTEL_RESOURCE_ATTRIBUTES: `aws.log.group.names=${logGroup.logGroupName},service.name=${serviceName}`,
                OTEL_AWS_APPLICATION_SIGNALS_ENABLED: 'true',
                OTEL_AWS_APPLICATION_SIGNALS_EXPORTER_ENDPOINT: 'http://localhost:4316/v1/metrics',
                OTEL_METRICS_EXPORTER: 'none',
                JAVA_TOOL_OPTIONS: ' -javaagent:/otel-auto-instrumentation/javaagent.jar',
                SPRING_PROFILES_ACTIVE: 'ecs',
                ...environmentArgs,
            },
            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: logGroup,
            }),
        });

        // Add Port Mapping
        mainContainer.addPortMappings({
            containerPort: port,
            protocol: Protocol.TCP,
        });

        mainContainer.addMountPoints({
            sourceVolume: 'opentelemetry-auto-instrumentation',
            containerPath: '/otel-auto-instrumentation',
            readOnly: false,
        });

        // Add init container
        const initContainer = taskDefinition.addContainer(`${serviceName}-init-container`, {
            image: ContainerImage.fromRegistry(
                `public.ecr.aws/aws-observability/adot-autoinstrumentation-java:${this.adotJavaImageTag}`,
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
        taskDefinition.addContainer(`${serviceName}-cwagent-container`, {
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
                                rules: rules,
                            },
                        },
                    },
                }),
            },

            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: cwAgentLogGroup,
            }),
        });

        return taskDefinition;
    }

    createPythonTaskDefinition(serviceName: string, config: string, healthCheck?: HealthCheck) {
        const { image, environmentArgs, port, rules, command } = JSON.parse(config);

        const logGroup = this.logStack.createLogGroup(serviceName);
        const cwAgentLogGroup = this.logStack.createLogGroup(`${serviceName}-cwagent`);

        // Create ECS task definition
        const taskDefinition = new TaskDefinition(this, `${serviceName}-task`, {
            cpu: '256',
            memoryMiB: '512',
            compatibility: Compatibility.FARGATE,
            family: serviceName,
            networkMode: NetworkMode.AWS_VPC,
            taskRole: this.ecsTaskRole,
            executionRole: this.ecsTaskExecutionRole,
        });

        taskDefinition.addVolume({
            name: 'opentelemetry-auto-instrumentation-python',
        });

        // Add Container to Task Definition
        const mainContainer = taskDefinition.addContainer(`${serviceName}-container`, {
            image: ContainerImage.fromRegistry(`${this.ecrImagePrefix}/${image}`),
            cpu: 256,
            memoryLimitMiB: 512,
            essential: true,
            secrets: {
                DB_USER: EcsSecret.fromSecretsManager(this.dbSecret, 'username'),
                DB_USER_PASSWORD: EcsSecret.fromSecretsManager(this.dbSecret, 'password'),
            },
            environment: {
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
                OTEL_RESOURCE_ATTRIBUTES: `service.name=${serviceName}`,
                OTEL_METRICS_EXPORTER: 'none',
                OTEL_PYTHON_DISTRO: 'aws_distro',
                EUREKA_SERVER_URL: `${this.DISCOVERY_SERVER}-DNS.${this.serviceDiscoveryStack.namespace.namespaceName}`,
                DB_NAME: 'postgres',
                DATABASE_PROFILE: 'postgresql',
                DB_SERVICE_HOST: this.dbInstanceEndpointAddress,
                DB_SERVICE_PORT: '5432',
                ...environmentArgs,
            },
            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: logGroup,
            }),
            command: command,
            healthCheck,
        });

        // Add Port Mapping
        mainContainer.addPortMappings({
            containerPort: port,
            protocol: Protocol.TCP,
        });

        mainContainer.addMountPoints({
            sourceVolume: 'opentelemetry-auto-instrumentation-python',
            containerPath: '/otel-auto-instrumentation-python',
            readOnly: false,
        });

        // Add init container
        const initContainer = taskDefinition.addContainer(`${serviceName}-init-container`, {
            image: ContainerImage.fromRegistry(
                `public.ecr.aws/aws-observability/adot-autoinstrumentation-python:${this.adotPythonImageTag}`,
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
        taskDefinition.addContainer(`${serviceName}-cwagent-container`, {
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
                                rules: rules,
                            },
                        },
                    },
                }),
            },

            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: cwAgentLogGroup,
            }),
        });

        return taskDefinition;
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

    createServerTaskDefinition(serverName: string, config: string) {
        const { image, port, environmentArgs } = JSON.parse(config);

        const logGroup = this.logStack.createLogGroup(serverName);
        const taskDefinition = new TaskDefinition(this, `${serverName}-task`, {
            cpu: '256',
            memoryMiB: '512',
            compatibility: Compatibility.FARGATE,
            family: serverName,
            networkMode: NetworkMode.AWS_VPC,
            taskRole: this.ecsTaskRole,
            executionRole: this.ecsTaskExecutionRole,
        });

        // Add Container to Task Definition
        const container = taskDefinition.addContainer(`${serverName}-container`, {
            image: ContainerImage.fromRegistry(`${this.ecrImagePrefix}/springcommunity/${image}`),
            cpu: 256,
            memoryLimitMiB: 512,
            essential: true,
            environment: {
                SPRING_PROFILES_ACTIVE: 'ecs',
                ...environmentArgs,
            },
            logging: LogDrivers.awsLogs({
                streamPrefix: 'ecs',
                logGroup: logGroup,
            }),
        });

        container.addPortMappings({
            containerPort: port,
            protocol: Protocol.TCP,
        });

        return taskDefinition;
    }
}
