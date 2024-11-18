import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as cloudformation from 'aws-cdk-lib/aws-cloudformation';

// define a stack props that extend StackProps by adding a timeout properties
interface NoopWaitStackProps extends StackProps {
  timeout?: string;
}



export class NoopWaitStack extends Stack {
  constructor(scope: cdk.App, id: string, props?: NoopWaitStackProps) {
    super(scope, id, props);

    // Create a CloudFormation Wait Handle
    const waitHandle = new cloudformation.CfnWaitConditionHandle(this, 'WaitHandle');

    // Create a Wait Condition
    const waitCondition = new cloudformation.CfnWaitCondition(this, 'WaitCondition', {
      count: 1, // Expecting 1 signal
      handle: waitHandle.ref, // Reference the Wait Handle
      timeout: props?.timeout || '300', // Timeout in seconds (5 minutes)
    });

    // Add a stack description for clarity
    this.templateOptions.description = 'A no-op stack that waits for 5 minutes before completing.';
  }
}