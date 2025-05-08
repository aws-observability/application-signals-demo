import {Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import {CfnIdentityPool, CfnIdentityPoolRoleAttachment} from "aws-cdk-lib/aws-cognito";
import {CfnAppMonitor} from "aws-cdk-lib/aws-rum";
import {FederatedPrincipal, PolicyDocument, PolicyStatement, Role} from "aws-cdk-lib/aws-iam";

interface CloudWatchRumStackProps extends StackProps {
  sampleAppNamespace: string,
}

export class CloudWatchRumStack extends Stack {
  public readonly appMonitorId: string;
  public readonly identityPoolId: string;
  public readonly unauthRole: Role;

  private readonly props: CloudWatchRumStackProps;

  private readonly appMonitorName: string;

  constructor(scope: Construct, id: string, props: CloudWatchRumStackProps) {
    super(scope, id, props);
    this.props = props;
    this.appMonitorName = `${this.props.sampleAppNamespace}-client`;

    const cognitoIdentity = this.createCognitoIdentityPool();
    this.identityPoolId = cognitoIdentity.ref;

    this.unauthRole = this.createUnauthenticatedRole(cognitoIdentity);

    const appMonitor = this.createAppMonitor(cognitoIdentity, this.unauthRole);
    this.appMonitorId = appMonitor.attrId;
  }

  private createCognitoIdentityPool() {
    // Create Congito Identity
    return new CfnIdentityPool(this, 'RumCognitoIdentityPool', {
      allowUnauthenticatedIdentities: true,
      allowClassicFlow: true,
      identityPoolName: 'PetClinicRumIdentityPool',
    });
  }

  private createUnauthenticatedRole(cognitoIdentity: CfnIdentityPool) {
    // Create IAM Policy
    const putRumEventsPolicy = new PolicyDocument({
      statements: [
        new PolicyStatement({
          actions: ['rum:PutRumEvents'],
          resources: [`arn:aws:rum:${this.region}:${this.account}:appmonitor/${this.appMonitorName}`],
        }),
      ],
    });

    // Create IAM Role
    const unauthRole = new Role(this, 'UnauthenticatedRole', {
      roleName: 'UnauthenticatedMonitoringRole',
      description: 'Role assumed by unauthenticated RUM clients.',
      assumedBy: new FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': cognitoIdentity.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      inlinePolicies: {
        PutRumEventsPolicy: putRumEventsPolicy,
      },
    });

    // Attach IAM Role to Cognito Identity
    new CfnIdentityPoolRoleAttachment(this, 'UnauthenticatedIdentityRoleAttachment', {
      identityPoolId: cognitoIdentity.ref,
      roles: {
        unauthenticated: unauthRole.roleArn,
      },
    });

    return unauthRole;
  }

  private createAppMonitor(cognitoIdentity: CfnIdentityPool, unauthRole: Role): CfnAppMonitor {
    // Create App Monitor
    return new CfnAppMonitor(this, 'PetClinicAppMonitor', {
      appMonitorConfiguration: {
        allowCookies: true,
        enableXRay: true,
        guestRoleArn: unauthRole.roleArn,
        identityPoolId: cognitoIdentity.ref,
        sessionSampleRate: 1,
        telemetries: ['performance', 'errors', 'http'],
        metricDestinations: [
          {
            destination: 'CloudWatch',
            metricDefinitions: this.getMetricDefinitions(),
          },
        ],
      },
      customEvents: {
        status: 'ENABLED',
      },
      cwLogEnabled: true,
      domain: `*.${this.region}.elb.amazonaws.com`,
      name: this.appMonitorName,
    });
  }

  private getMetricDefinitions(): Array<CfnAppMonitor.MetricDefinitionProperty> {
    return [
      {
        name: 'JsErrorCount',
        namespace: 'AWS/RUM',
        unitLabel: 'Count',
        dimensionKeys: {
          'metadata.pageId': 'PageId',
        },
        eventPattern: '{"event_type":["com.amazon.rum.js_error_event"],"metadata":{"pageId":["/welcome"]}}',
      },
      {
        name: 'HttpErrorCount',
        namespace: 'AWS/RUM',
        unitLabel: 'Count',
        dimensionKeys: {
          'metadata.pageId': 'PageId',
        },
        eventPattern: '{"event_type":["com.amazon.rum.http_event"],"metadata":{"pageId":["/welcome"]}}',
      },
      {
        name: 'WebVitalsLargestContentfulPaint',
        namespace: 'AWS/RUM',
        unitLabel: 'Milliseconds',
        valueKey: 'event_details.value',
        dimensionKeys: {
          'metadata.pageId': 'PageId',
        },
        eventPattern:
          '{"event_type":["com.amazon.rum.largest_contentful_paint_event"],"metadata":{"pageId":["/welcome"]}}',
      },
      {
        name: 'WebVitalsCumulativeLayoutShift',
        namespace: 'AWS/RUM',
        valueKey: 'event_details.value',
        dimensionKeys: {
          'metadata.pageId': 'PageId',
        },
        eventPattern:
          '{"event_type":["com.amazon.rum.cumulative_layout_shift_event"],"metadata":{"pageId":["/welcome"]}}',
      },
      {
        name: 'WebVitalsFirstInputDelay',
        namespace: 'AWS/RUM',
        unitLabel: 'Milliseconds',
        valueKey: 'event_details.value',
        dimensionKeys: {
          'metadata.pageId': 'PageId',
        },
        eventPattern: '{"event_type":["com.amazon.rum.first_input_delay_event"],"metadata":{"pageId":["/welcome"]}}',
      },
    ];
  }
}
