#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { IAMStack } from '../lib/stacks/iam-stack';
import { EksStack } from '../lib/stacks/eks-stack';
import { SloStack } from '../lib/stacks/slo-stack';
import { RdsStack } from '../lib/stacks/rds-stack';
import { SyntheticCanaryStack } from '../lib/stacks/canary-stack';
import { MyApplicationStack } from "../lib/stacks/my-application-stack";
import { CloudWatchRumStack } from "../lib/stacks/rum-stack";

const app = new App();

const enableSlo = app.node.tryGetContext('enableSlo') || false;

const networkStack = new NetworkStack(app, 'AppSignalsEksNetworkStack');
const iamStack = new IAMStack(app, 'AppSignalsEksIamStack');

const rdsStack = new RdsStack(app, 'AppSignalsEksRdsStack', {
  vpc: networkStack.vpc,
  rdsSecurityGroup: networkStack.rdsSecurityGroup,
})

rdsStack.addDependency(networkStack);

const myApplicationStack = new MyApplicationStack(app, 'MyApplicationStack')

const rumStack = new CloudWatchRumStack(app, 'AppSignalsRumStack', {
  sampleAppNamespace: 'pet-clinic', // Using the same namespace as in EksStack
})

const eksStack = new EksStack(app, 'AppSignalsEksClusterStack', {
  vpc: networkStack.vpc,
  eksClusterRoleProp: iamStack.eksClusterRoleProp,
  eksNodeGroupRoleProp: iamStack.eksNodeGroupRoleProp,
  ebsCsiAddonRoleProp: iamStack.ebsCsiAddonRoleProp,
  sampleAppRoleProp: iamStack.sampleAppRoleProp,
  cloudwatchAddonRoleProp: iamStack.cloudwatchAddonRoleProp,
  rdsClusterEndpoint: rdsStack.clusterEndpoint,
  rdsSecurityGroupId: networkStack.rdsSecurityGroupId,
  awsApplicationTag: myApplicationStack.application.attrApplicationTagValue,
  rumIdentityPoolId: rumStack.identityPoolId,
  rumAppMonitorId: rumStack.appMonitorId
});

eksStack.addDependency(networkStack);
eksStack.addDependency(iamStack);
eksStack.addDependency(rdsStack);
eksStack.addDependency(myApplicationStack);
eksStack.addDependency(rumStack);

const syntheticCanaryStack = new SyntheticCanaryStack(app, 'AppSignalsSyntheticCanaryStack', {
  vpc: networkStack.vpc,
  albEndpoint: eksStack.ingressExternalIp.value,
  syntheticCanaryRoleProp: iamStack.syntheticCanaryRoleProp,
})

syntheticCanaryStack.addDependency(rdsStack);
syntheticCanaryStack.addDependency(rumStack);

// After AppSignal is enabled, it takes up to 10 minutes for the SLO metrics to become available. If this is deployed before the SLO metrics
// are available, it will fail.
if (enableSlo) {
  const sloStack = new SloStack(app, 'AppSignalsSloStack', {
    eksClusterName: eksStack.CLUSTER_NAME,
    sampleAppNamespace: eksStack.SAMPLE_APP_NAMESPACE,
    awsApplicationTag: myApplicationStack.application.attrApplicationTagValue
  })

  sloStack.addDependency(syntheticCanaryStack);
}
