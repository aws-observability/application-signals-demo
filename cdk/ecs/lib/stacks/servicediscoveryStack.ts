import { Construct } from 'constructs';
import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { PrivateDnsNamespace, Service, RoutingPolicy, DnsRecordType } from 'aws-cdk-lib/aws-servicediscovery';
import { Vpc } from 'aws-cdk-lib/aws-ec2';

interface ServiceDiscoveryStackProps extends StackProps {
    readonly vpc: Vpc;
}

export class ServiceDiscoveryStack extends Stack {
    public readonly namespace: PrivateDnsNamespace;

    constructor(scope: Construct, id: string, props: ServiceDiscoveryStackProps) {
        super(scope, id);

        this.namespace = new PrivateDnsNamespace(this, 'Namespace', {
            vpc: props.vpc,
            name: 'ecs-pet-clinic',
        });

        new CfnOutput(this, 'NamespaceId', { value: this.namespace.namespaceId });
    }

    createService(serviceName: string) {
        const dnsService = `${serviceName}-DNS`;
        return new Service(this, dnsService, {
            namespace: this.namespace,
            name: dnsService,
            customHealthCheck: {
                failureThreshold: 2, // TODO: A known issue that failure threshold cannot be set other than 1: https://github.com/hashicorp/terraform-provider-aws/issues/35559
            },
            routingPolicy: RoutingPolicy.WEIGHTED,
            dnsRecordType: DnsRecordType.A,
            dnsTtl: Duration.seconds(300),
        });
    }
}
