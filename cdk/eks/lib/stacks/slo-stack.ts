import { Construct } from 'constructs';
import { aws_applicationsignals as applicationsignals, Stack, StackProps, CfnWaitConditionHandle, CfnWaitCondition  } from 'aws-cdk-lib';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';

interface SloProps extends StackProps {
    eksClusterName: string,
    sampleAppNamespace: string,
  }

export class SloStack extends Stack {
    private readonly serviceName = 'pet-clinic-frontend-java'
    private readonly endpoint = `https://application-signals.${this.region}.api.aws`;
    private readonly eksClusterName: string;
    private readonly sampleAppNamespace: string;
      
  constructor(scope: Construct, id: string, props: SloProps) {
    super(scope, id, props);

    const { eksClusterName, sampleAppNamespace } = props;

    this.eksClusterName = eksClusterName;
    this.sampleAppNamespace = sampleAppNamespace

    const enableTopologyDiscovery = new AwsCustomResource(this, 'ApplicationSignalsStartDiscovery', {
        onUpdate: {
            service: 'application-signals',
            action: 'StartDiscovery',
            parameters: {
                Endpoint: this.endpoint,
            },
            physicalResourceId: PhysicalResourceId.of('StartDiscoveryOperation'),
        },
        policy: AwsCustomResourcePolicy.fromSdkCalls({
            resources: AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
    });

    const getOwner99AvailabilitySlo = new applicationsignals.CfnServiceLevelObjective(this, 'getOwner99AvailabilitySLO', this.getSloProp(
        "Availability for Searching an Owner",
        "Availability larger than 99 for Get Owner operation",
        "GET",
        "AVAILABILITY",
        99.0,
        "GreaterThan"
    ));
    const getOwner99LatencySlo = new applicationsignals.CfnServiceLevelObjective(this, 'getOwner99LatencySLO', this.getSloProp(
        "Latency for Searching an Owner",
        "Latency P99 less than 200 ms for Get Owner operation",
        "GET",
        "LATENCY",
        200.0,
        "LessThan",
        "p99"
    ));
    const postOwner99AvailabilitySlo = new applicationsignals.CfnServiceLevelObjective(this, 'postOwner99AvailabilitySLO', this.getSloProp(
        "Availability for Registering an Owner",
        "Availability larger than 99 for Post Owner operation",
        "POST",
        "AVAILABILITY",
        99.0,
        "GreaterThan"
    ));
    const postOwner99LatencySlo = new applicationsignals.CfnServiceLevelObjective(this, 'postOwner99LatencyProp', this.getSloProp(
        "Latency for Registering an Owner",
        "Latency P99 less than 2000 ms for Post Owner operation",
        "POST",
        "LATENCY",
        200.0,
        "LessThan",
        "p99"
    ));

    getOwner99AvailabilitySlo.node.addDependency(enableTopologyDiscovery);
    getOwner99LatencySlo.node.addDependency(enableTopologyDiscovery);
    postOwner99AvailabilitySlo.node.addDependency(enableTopologyDiscovery);
    postOwner99LatencySlo.node.addDependency(enableTopologyDiscovery);
  }
  
  getSloProp(name: string, description: string, requestType: string, metricType: string, metricThreshold: number, comparisonOperator: string, statistic?: string) {
    const sloProp: applicationsignals.CfnServiceLevelObjectiveProps = {
        name: name, 
        description: description,
        sli: {
            sliMetric: {
                keyAttributes: {
                    "Environment": `eks:${this.eksClusterName}/${this.sampleAppNamespace}`,
                    "Name": this.serviceName,
                    "Type": "Service"
                },
                operationName:`${requestType} /api/customer/owners`,
                metricType: metricType,
                statistic: statistic,
                periodSeconds: 60
            },
            metricThreshold: metricThreshold,
            comparisonOperator: comparisonOperator,
          },
          goal: {
            interval: {
                rollingInterval: {
                    duration: 1,
                    durationUnit: "DAY",
                }
            },
            attainmentGoal: 99.9,
            warningThreshold: 60.0,
          }
    }
    return sloProp
  }
}