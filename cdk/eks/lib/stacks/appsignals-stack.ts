import { Construct } from 'constructs';
import { StackProps, Stack, CfnJson } from 'aws-cdk-lib';
import { Role, RoleProps, PolicyStatement, FederatedPrincipal, Effect } from 'aws-cdk-lib/aws-iam';
import { CfnAddon, Cluster,  ICluster } from 'aws-cdk-lib/aws-eks';

interface EnableAppSignalsStackProps extends StackProps {
  eksCluster: Cluster;
  cloudwatchAddonRoleProp: RoleProps,
}

export class EnableAppSignalsStack extends Stack {
  private readonly eksCluster: Cluster;
  private readonly cloudwatchAddonRole: Role;

  constructor(scope: Construct, id: string, props: EnableAppSignalsStackProps) {
    super(scope, id, props);
    this.terminationProtection = true;

    const { eksCluster, cloudwatchAddonRoleProp } = props;
    this.eksCluster = eksCluster
    this.cloudwatchAddonRole = new Role(this, 'CloduwatchAddonRoleTest25', cloudwatchAddonRoleProp);


    // Apply federated principal to the cloudwatch addon role
    const openIdConnectProviderIssuer = this.eksCluster.openIdConnectProvider.openIdConnectProviderIssuer;
    const stringCondition = new CfnJson(this, `CloudwatchAddonOidcCondition`, {
      value: {
        [`${openIdConnectProviderIssuer}:aud`]: 'sts.amazonaws.com',
      },
    });

    const federatedPrincipal = new FederatedPrincipal(
      this.eksCluster.openIdConnectProvider.openIdConnectProviderArn,
      {
        'StringEquals': stringCondition,
      },
      'sts:AssumeRoleWithWebIdentity'
    )
  
    this.cloudwatchAddonRole.assumeRolePolicy?.addStatements(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [federatedPrincipal],
        actions: ['sts:AssumeRoleWithWebIdentity'],
      })
    );

    new CfnAddon(this, 'CloudWatchAddonAddon', {
      addonName: 'amazon-cloudwatch-observability',
      clusterName: this.eksCluster.clusterName,
      serviceAccountRoleArn: this.cloudwatchAddonRole.roleArn, 
      resolveConflicts: 'OVERWRITE',
    });
  }
}