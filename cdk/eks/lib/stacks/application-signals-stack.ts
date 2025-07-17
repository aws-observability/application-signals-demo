import * as cdk from 'aws-cdk-lib';
import { aws_applicationsignals as applicationsignals } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ApplicationSignalsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Enable AWS Application Signals by creating the discovery resource
    const cfnDiscovery = new applicationsignals.CfnDiscovery(
      this, 
      'ApplicationSignalsServiceRole', 
      { }
    );
  }
}