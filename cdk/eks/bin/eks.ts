#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { IAMStack } from '../lib/stacks/iam-stack';
import { EksStack } from '../lib/stacks/eks-stack';
import { SloStack } from '../lib/stacks/slo-stack';
import { SyntheticCanaryStack } from '../lib/stacks/canary-stack';

const app = new App();

const enableSlo = app.node.tryGetContext('enableSlo') || false;

const networkStack = new NetworkStack(app, 'AppSignalsEksNetworkStack');
const iamStack = new IAMStack(app, 'AppSignalsEksIamStack');

const eksStack = new EksStack(app, 'AppSignalsEksClusterStack', {
  vpc: networkStack.vpc,
  eksClusterRoleProp: iamStack.eksClusterRoleProp,
  eksNodeGroupRoleProp: iamStack.eksNodeGroupRoleProp,
  ebsCsiAddonRoleProp: iamStack.ebsCsiAddonRoleProp,
  sampleAppRoleProp: iamStack.sampleAppRoleProp,
  cloudwatchAddonRoleProp: iamStack.cloudwatchAddonRoleProp,
});

eksStack.addDependency(networkStack);
eksStack.addDependency(iamStack);

const syntheticCanaryStack = new SyntheticCanaryStack(app, 'AppSignalsSyntheticCanaryStack', {
  vpc: networkStack.vpc,
  nginxEndpoint: eksStack.ingressExternalIp.value,
  syntheticCanaryRoleProp: iamStack.syntheticCanaryRoleProp,
})

syntheticCanaryStack.addDependency(eksStack);

// After AppSignal is enabled, it takes up to 10 minutes for the SLO metrics to become available. If this is deployed before the SLO metrics
// are available, it will fail. 
if (enableSlo) {
  const sloStack = new SloStack(app, 'AppSignalsSloStack', {
    eksClusterName: eksStack.CLUSTER_NAME,
    sampleAppNamespace: eksStack.SAMPLE_APP_NAMESPACE,
  })
  
  sloStack.addDependency(syntheticCanaryStack);
}

