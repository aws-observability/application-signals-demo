import { Construct } from 'constructs';
import { aws_applicationsignals as applicationsignals, Stack, StackProps, Tag } from 'aws-cdk-lib';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import {CfnServiceLevelObjective} from "aws-cdk-lib/aws-applicationsignals";
import ExclusionWindowProperty = CfnServiceLevelObjective.ExclusionWindowProperty;


interface SloProps extends StackProps {
    eksClusterName: string,
    sampleAppNamespace: string,
    awsApplicationTag: string,
  }

export class SloStack extends Stack {
    private readonly serviceName = 'pet-clinic-frontend-java'
    private readonly endpoint = `https://application-signals.${this.region}.api.aws`;
    private readonly eksClusterName: string;
    private readonly sampleAppNamespace: string;
      
  constructor(scope: Construct, id: string, props: SloProps) {
    super(scope, id, props);

    const { eksClusterName, sampleAppNamespace, awsApplicationTag } = props;

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
        policy: AwsCustomResourcePolicy.fromStatements([
            new PolicyStatement({
                actions: [
                    'application-signals:StartDiscovery',
                    'iam:CreateServiceLinkedRole',
                ],
                resources: ['*'],
            }),
        ]),
    });

    const getOwner99AvailabilitySlo = new applicationsignals.CfnServiceLevelObjective(this, 'getOwner99AvailabilitySLO', this.getSloProp(
        "Availability for Searching an Owner",
        "Availability larger than 99 for Get Owner operation",
        "GET",
        "AVAILABILITY",
        99.0,
        "GreaterThan",
        awsApplicationTag,
    ));
    const getOwner99LatencySlo = new applicationsignals.CfnServiceLevelObjective(this, 'getOwner99LatencySLO', this.getSloProp(
        "Latency for Searching an Owner",
        "Latency P99 less than 200 ms for Get Owner operation",
        "GET",
        "LATENCY",
        200.0,
        "LessThan",
        awsApplicationTag,
        "p99"
    ));
    const postOwner99AvailabilitySlo = new applicationsignals.CfnServiceLevelObjective(this, 'postOwner99AvailabilitySLO', this.getSloProp(
        "Availability for Registering an Owner",
        "Availability larger than 99 for Post Owner operation",
        "POST",
        "AVAILABILITY",
        99.0,
        "GreaterThan",
        awsApplicationTag,
    ));
    const postOwner99LatencySlo = new applicationsignals.CfnServiceLevelObjective(this, 'postOwner99LatencySLO', this.getSloProp(
        "Latency for Registering an Owner",
        "Latency P99 less than 2000 ms for Post Owner operation",
        "POST",
        "LATENCY",
        2000.0,
        "LessThan",
        awsApplicationTag,
        "p99"
    ));
    const billingActivitiesLatencySlo = new applicationsignals.CfnServiceLevelObjective(this, 'billingActivitiesLatencySLO', this.getSloProp(
        "Latency for Billing Activities",
        "Latency P99 less than 300 ms for GET Billing Activities operation",
        "GET",
        "LATENCY",
        300.0,
        "LessThan",
        awsApplicationTag,
        "p99",
        "^billings/$",
        "billing-service-python"
    ));

    const exclusionWindows = [{
         window: {
             duration: 16,
             durationUnit: 'HOUR',
         },
         recurrenceRule: {
             expression: 'cron(0 17 ? * *)',
         }
    }]
    const getPaymentAvailabilitySlo = new applicationsignals.CfnServiceLevelObjective(this, 'getPaymentAvailabilitySLO', this.getSloProp(
        "Availability for Retrieving Payments",
        "Availability larger than 99 for Get Payment operation",
        "GET",
        "AVAILABILITY",
        99.0,
        "GreaterThan",
        awsApplicationTag,
        undefined,
        "/owners/{ownerId:int}/pets/{petId:int}/payments/",
        "payment-service-dotnet",
        undefined,
        exclusionWindows
    ));

    getOwner99AvailabilitySlo.node.addDependency(enableTopologyDiscovery);
    getOwner99LatencySlo.node.addDependency(enableTopologyDiscovery);
    postOwner99AvailabilitySlo.node.addDependency(enableTopologyDiscovery);
    postOwner99LatencySlo.node.addDependency(enableTopologyDiscovery);
    billingActivitiesLatencySlo.node.addDependency(enableTopologyDiscovery);
    getPaymentAvailabilitySlo.node.addDependency(enableTopologyDiscovery);
  }
  
  getSloProp(name: string, description: string, requestType: string, metricType: string, metricThreshold: number, comparisonOperator: string, awsApplicationTag: string, statistic?: string, operationPath?: string, serviceName?: string, serviceType?: string, exclusionWindows?: ExclusionWindowProperty[]) {
    // Default values
    const path = operationPath || '/api/customer/owners';
    const service = serviceName || this.serviceName;
    const type = serviceType || 'Service';
    const environment = type === 'Lambda' ? 
      undefined : 
      { "Environment": `eks:${this.eksClusterName}/${this.sampleAppNamespace}` };
    
    const sloProp: applicationsignals.CfnServiceLevelObjectiveProps = {
        name: name, 
        description: description,
        sli: {
            sliMetric: {
                keyAttributes: {
                    ...(environment || {}),
                    "Name": service,
                    "Type": type
                },
                operationName: type === 'Lambda' ? undefined : `${requestType} ${path}`,
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
          },
          tags: [
            new Tag("awsApplication", awsApplicationTag)
          ],
          exclusionWindows: exclusionWindows
    }
    return sloProp
  }
}