import * as cdk from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { aws_xray as xray } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface TransactionSearchStackProps extends cdk.StackProps {
  /**
   * The percentage of eligible traces to index. Valid values are 0 to 100 (inclusive).
   * A value of 0 means no sampling. Default is 10%.
   */
  indexingPercentage?: number;
}

export class TransactionSearchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TransactionSearchStackProps = {}) {
    super(scope, id, props);

    // Define default indexing percentage if not provided
    const indexingPercentage = props.indexingPercentage || 10;

    // Create the resource policy
    const transactionSearchAccess = new logs.CfnResourcePolicy(this, 'XRayLogResourcePolicy', {
      policyName: 'TransactionSearchAccess',
      policyDocument: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'TransactionSearchXRayAccess',
            Effect: 'Allow',
            Principal: {
              Service: 'xray.amazonaws.com',
            },
            Action: 'logs:PutLogEvents',
            Resource: [
              `arn:${this.partition}:logs:${this.region}:${this.account}:log-group:aws/spans:*`,
              `arn:${this.partition}:logs:${this.region}:${this.account}:log-group:/aws/application-signals/data:*`,
            ],
            Condition: {
              ArnLike: {
                'aws:SourceArn': `arn:${this.partition}:xray:${this.region}:${this.account}:*`,
              },
              StringEquals: {
                'aws:SourceAccount': this.account,
              },
            },
          },
        ],
      }),
    });

    // Create the TransactionSearchConfig with dependency
    const transactionSearchConfig = new xray.CfnTransactionSearchConfig(this, 'XRayTransactionSearchConfig', {
      indexingPercentage: indexingPercentage,
    });

    // Add the dependency to ensure Resource Policy is created first
    transactionSearchConfig.addDependsOn(transactionSearchAccess);

    // Output the indexing percentage
    new cdk.CfnOutput(this, 'XRayIndexingPercentage', {
      value: indexingPercentage.toString(),
      description: 'The percentage of eligible traces indexed for transaction search',
    });
  }
}