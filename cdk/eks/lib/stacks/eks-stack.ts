import * as path from 'path';
import { Construct } from 'constructs';
import { StackProps, Stack, CfnJson, Fn, CfnWaitConditionHandle, CfnWaitCondition } from 'aws-cdk-lib';
import { Vpc, InstanceType, ISecurityGroup,SecurityGroup, Port } from 'aws-cdk-lib/aws-ec2';
import { Role, RoleProps, PolicyStatement, FederatedPrincipal, Effect } from 'aws-cdk-lib/aws-iam';
import { CfnAddon, Cluster, KubernetesManifest, KubernetesVersion, ServiceAccount, KubernetesObjectValue, Nodegroup } from 'aws-cdk-lib/aws-eks';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { KubectlV31Layer } from '@aws-cdk/lambda-layer-kubectl-v31';

import { readYamlFile, getYamlFiles, transformNameToId, transformYaml } from '../utils/utils';

interface EksStackProps extends StackProps {
  vpc: Vpc;
  eksClusterRoleProp: RoleProps,
  eksNodeGroupRoleProp: RoleProps,
  ebsCsiAddonRoleProp: RoleProps,
  sampleAppRoleProp: RoleProps,
  cloudwatchAddonRoleProp: RoleProps,
  rdsClusterEndpoint: string,
  rdsSecurityGroupId: string,
  awsApplicationTag: string,
  rumIdentityPoolId: string,
  rumAppMonitorId: string
}

export class EksStack extends Stack {
  public readonly CLUSTER_NAME = 'eks-pet-clinic-demo';
  public readonly SAMPLE_APP_NAMESPACE = 'pet-clinic';
  private readonly NGINX_INGRESS_NAMESPACE = 'ingress-nginx';
  private readonly VISITS_SERVICE_ACCOUNT_NAME = 'visits-service-account';
  private readonly OTEL_COLLECTOR_SERVICE_ACCOUNT_NAME = 'otel-collector-service-account';

  // Path to the yaml manifests to deploy to EKS
  private readonly sampleAppManifestPath = path.join(__dirname, '..', 'manifests/sample-app');
  private readonly dbManifestPath = path.join(__dirname, '..', 'manifests/db');
  private readonly mongodbManifestPath = path.join(__dirname, '..', 'manifests/mongodb');
  private readonly nginxIngressManifestPath = path.join(__dirname, '..', 'manifests/k8s-nginx-ingress');
  private readonly trafficGeneratorManifestPath = path.join(__dirname, '..', 'manifests/traffic-generator');

  private readonly clusterKubernetesVersion = KubernetesVersion.V1_31;

  // From StackProp
  private readonly vpc: Vpc;
  private readonly eksClusterRole: Role;
  private readonly eksNodeGroupRole: Role;
  private readonly ebsCsiDriverAddonRole: Role;
  private readonly sampleAppRole: Role;
  private readonly cloudwatchAddonRole: Role;
  private readonly rumIdentityPoolId: string;
  private readonly rumAppMonitorId: string;

  // Constructs generated in this stack
  private readonly cluster: Cluster;
  private readonly ebsCsiDriverAddon: CfnAddon;
  private readonly cloudwatchAddon: CfnAddon;
  private readonly visitsServiceServiceAccount : ServiceAccount;
  private readonly otelCollectorServiceServiceAccount : ServiceAccount;
  private readonly sampleAppNamespace: KubernetesManifest;
  private readonly nginxIngressNamespace: KubernetesManifest;
  private readonly nginxIngressManifests: KubernetesManifest[];

  // Ingress External Ip
  public readonly ingressExternalIp: KubernetesObjectValue;
  private readonly rdsSecurityGroup: ISecurityGroup;
  private readonly rdsClusterEndpoint: string;

  constructor(scope: Construct, id: string, props: EksStackProps) {
    super(scope, id, props);

    const { vpc, eksClusterRoleProp, eksNodeGroupRoleProp, ebsCsiAddonRoleProp, sampleAppRoleProp, cloudwatchAddonRoleProp, rdsClusterEndpoint, rdsSecurityGroupId, awsApplicationTag, rumIdentityPoolId, rumAppMonitorId } = props;
    this.vpc = vpc;
    this.rdsClusterEndpoint = rdsClusterEndpoint;
    this.rumIdentityPoolId = rumIdentityPoolId;
    this.rumAppMonitorId = rumAppMonitorId;
    this.rdsSecurityGroup = SecurityGroup.fromSecurityGroupId(
      this,
      'ImportedRdsSecurityGroup',
      rdsSecurityGroupId
    );

    // The IAM roles must be created in the EKS stack because some of the roles need to be given federated principals, and this cannot be done if the role is imported
    this.eksClusterRole = new Role(this, 'EksClusterRole', eksClusterRoleProp);
    this.eksNodeGroupRole = new Role(this, 'EksNodeGroupRole', eksNodeGroupRoleProp);
    this.ebsCsiDriverAddonRole = new Role(this, 'EbsCsiDriverAddonRole', ebsCsiAddonRoleProp);
    this.sampleAppRole = new Role(this, 'SampleAppRole', sampleAppRoleProp);
    this.cloudwatchAddonRole = new Role(this, 'CloduwatchAddonRole', cloudwatchAddonRoleProp);

    // Create EKS Cluster
    this.cluster = this.createEksCluster(awsApplicationTag);
    // Add the Cloduwatch Addon
    this.cloudwatchAddon = this.addCloudwatchAddon();
    // Add the Ebs Csi Driver Addon
    this.ebsCsiDriverAddon = this.addEbsCsiDriverAddon();
    // Create pet-clinic namespace
    this.sampleAppNamespace = this.createNamespace(this.SAMPLE_APP_NAMESPACE);
    // Create ingress-nginx namespace
    this.nginxIngressNamespace = this.createNamespace(this.NGINX_INGRESS_NAMESPACE);
    // Create service accounts for the sample app in the pet-clinic namespace
    const { visitsServiceServiceAccount, otelCollectorServiceServiceAccount } = this.createSampleAppRoleServiceAccount();
    this.visitsServiceServiceAccount = visitsServiceServiceAccount;
    this.otelCollectorServiceServiceAccount = otelCollectorServiceServiceAccount;
    // Deploy the manifests for db. Db manifest relies on the ebs csi driver add-on
    this.deployManifests(this.dbManifestPath, [this.ebsCsiDriverAddon, this.visitsServiceServiceAccount, this.otelCollectorServiceServiceAccount ]);
    // Deploy the manifests for mongodb. Mongodb manifest relies on the ebs csi driver add-on
    this.deployManifests(this.mongodbManifestPath, [this.ebsCsiDriverAddon, this.visitsServiceServiceAccount, this.otelCollectorServiceServiceAccount ]);
    // Deploy the sample app.
    this.deployManifests(this.sampleAppManifestPath, [this.visitsServiceServiceAccount, this.otelCollectorServiceServiceAccount ]);
    // Deploy the ngnix ingress. 
    this.nginxIngressManifests = this.deployManifests(this.nginxIngressManifestPath, [this.nginxIngressNamespace]);
    // Get the ingress external ip
    this.ingressExternalIp = this.getIngressExternalIp();
    // Deploy the traffic generator
    this.deployManifests(this.trafficGeneratorManifestPath,  [this.sampleAppNamespace, ...this.nginxIngressManifests, this.ingressExternalIp]);
  }

  createEksCluster(awsApplicationTag: string) {
    const cluster = new Cluster(this, 'EKSCluster', {
      clusterName: this.CLUSTER_NAME, 
      version: this.clusterKubernetesVersion,
      mastersRole: this.eksClusterRole,
      vpc: this.vpc,
      defaultCapacity: 0,
      // Make sure this version matches the this.clusterKubernetesVersion
      kubectlLayer: new KubectlV31Layer(this, 'kubectl'),
      tags: {"awsApplication": awsApplicationTag}
    });

    // Retrieve the latest node group ami. This will ensure that the ami doesn't expire for long live instances
    const nodeGroupAmiReleaseVersion = StringParameter.valueForStringParameter(
      this,
      `/aws/service/eks/optimized-ami/${this.clusterKubernetesVersion.version}/amazon-linux-2/recommended/release_version`,
    );

    // Need at least 3 nodes to support all the pods for the sample app. Alternative is to upgrade the instance type
    // that can support more pods at once
    cluster.addNodegroupCapacity('SampleAppNodeGroup', {
      nodeRole: this.eksNodeGroupRole,
      instanceTypes: [
        new InstanceType('m5.large'),
      ],
      minSize: 5, 
      maxSize: 10,
      releaseVersion: nodeGroupAmiReleaseVersion,
    });

    this.rdsSecurityGroup.addIngressRule(
        cluster.connections.securityGroups[0],
        Port.tcp(5432),
        'Allow EKS to connect to RDS'
    )
    return cluster;
  }

  addEbsCsiDriverAddon() {
    this.addFederatedPrincipal(this.ebsCsiDriverAddonRole, 'EbsCsiDriverAddonRole', false);

    const addon = new CfnAddon(this, 'ebsCsiAddon', {
      addonName: 'aws-ebs-csi-driver', 
      clusterName: this.cluster.clusterName,
      serviceAccountRoleArn: this.ebsCsiDriverAddonRole.roleArn, 
      resolveConflicts: 'OVERWRITE', 
    });
    return addon;
  }

  createNamespace(namespace: string) {
    const manifest = this.cluster.addManifest(`${transformNameToId(namespace)}Namespace`, {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: namespace,
      },
    });
    return manifest;
  }

  createSampleAppRoleServiceAccount() {
    this.addFederatedPrincipal(this.sampleAppRole, 'SampleAppRole', true);

    const visitsServiceServiceAccount = this.cluster.addServiceAccount('VisitsServiceServiceAccount',
      {
        name: this.VISITS_SERVICE_ACCOUNT_NAME,
        namespace: this.SAMPLE_APP_NAMESPACE,
        annotations: {
          'eks.amazonaws.com/role-arn': this.sampleAppRole.roleArn,
        }
      }
    );

    const otelCollectorServiceServiceAccount = this.cluster.addServiceAccount('OtelCollectorServiceAccount',
      {
        name: this.OTEL_COLLECTOR_SERVICE_ACCOUNT_NAME,
        namespace: this.SAMPLE_APP_NAMESPACE,
        annotations: {
          'eks.amazonaws.com/role-arn': this.sampleAppRole.roleArn,
        }
      }
  );
    // The namespace needs to already exist before creating the service account
    visitsServiceServiceAccount.node.addDependency(this.sampleAppNamespace);
    otelCollectorServiceServiceAccount.node.addDependency(this.sampleAppNamespace);

    return { visitsServiceServiceAccount, otelCollectorServiceServiceAccount };
  }

  deployManifests(manifestPath: string, dependencies: any[]) {
    let manifests: KubernetesManifest[] = [];
    const manifestFiles = getYamlFiles(manifestPath);

    manifestFiles.forEach((file) => {
      const filePath = path.join(manifestPath, file);
      const yamlFile = readYamlFile(filePath);
      const transformedYamlFile = transformYaml(yamlFile, this.account, this.region, this.SAMPLE_APP_NAMESPACE, this.ingressExternalIp?.value, this.rdsClusterEndpoint, this.rumIdentityPoolId, this.rumAppMonitorId);
      const manifest = this.cluster.addManifest(transformNameToId(file), ...transformedYamlFile);

      dependencies.forEach((dependnecy) => {
        manifest.node.addDependency(dependnecy);
      })
      // Make sure that the cloudwatch addon exists already so that the services are discoverable  
      // without restarting the pods
      manifest.node.addDependency(this.cloudwatchAddon);
      
      manifests.push(manifest);
    })

    return manifests;
  }

  getIngressExternalIp() {
    const ingressIp = new KubernetesObjectValue(this, 'IngressNginxIp', {
      cluster: this.cluster,
      objectType: 'service',
      objectName: 'ingress-nginx',
      objectNamespace: 'ingress-nginx',
      jsonPath: '.status.loadBalancer.ingress[0].hostname', 
    });

    ingressIp.node.addDependency(...this.nginxIngressManifests);
  
    return ingressIp;
  }

  // The role name is required as a parameter because cdk cannot resovlve the rolename of the role at synthesis time
  addFederatedPrincipal(role: Role, roleName: string, isServiceAccount: boolean) {
    const openIdConnectProviderIssuer = this.cluster.openIdConnectProvider.openIdConnectProviderArn;
    
    // If this is not a service account, use the original approach with a single condition
    if (!isServiceAccount) {
      const stringCondition = new CfnJson(this, `${roleName}OidcCondition`, {
        value: {
          [`${this.cluster.openIdConnectProvider.openIdConnectProviderIssuer}:aud`]: 'sts.amazonaws.com',
        },
      });

      const federatedPrincipal = new FederatedPrincipal(
        this.cluster.openIdConnectProvider.openIdConnectProviderArn,
        {
          'StringEquals': stringCondition,
        },
        'sts:AssumeRoleWithWebIdentity'
      )
    
      role.assumeRolePolicy?.addStatements(
        new PolicyStatement({
          effect: Effect.ALLOW,
          principals: [federatedPrincipal],
          actions: ['sts:AssumeRoleWithWebIdentity'],
        })
      );
      return;
    }
    
    // For service accounts, create separate trust relationships for each service account
    
    // Add trust policy for the visits service account
    const visitsCondition = new CfnJson(this, `${roleName}VisitsOidcCondition`, {
      value: {
        [`${this.cluster.openIdConnectProvider.openIdConnectProviderIssuer}:aud`]: 'sts.amazonaws.com',
        [`${this.cluster.openIdConnectProvider.openIdConnectProviderIssuer}:sub`]: `system:serviceaccount:${this.SAMPLE_APP_NAMESPACE}:${this.VISITS_SERVICE_ACCOUNT_NAME}`,
      },
    });
    
    const visitsPrincipal = new FederatedPrincipal(
      this.cluster.openIdConnectProvider.openIdConnectProviderArn,
      {
        'StringEquals': visitsCondition,
      },
      'sts:AssumeRoleWithWebIdentity'
    );
    
    role.assumeRolePolicy?.addStatements(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [visitsPrincipal],
        actions: ['sts:AssumeRoleWithWebIdentity'],
      })
    );
    
    // Add trust policy for the otel collector service account
    const otelCondition = new CfnJson(this, `${roleName}OtelOidcCondition`, {
      value: {
        [`${this.cluster.openIdConnectProvider.openIdConnectProviderIssuer}:aud`]: 'sts.amazonaws.com',
        [`${this.cluster.openIdConnectProvider.openIdConnectProviderIssuer}:sub`]: `system:serviceaccount:${this.SAMPLE_APP_NAMESPACE}:${this.OTEL_COLLECTOR_SERVICE_ACCOUNT_NAME}`,
      },
    });
    
    const otelPrincipal = new FederatedPrincipal(
      this.cluster.openIdConnectProvider.openIdConnectProviderArn,
      {
        'StringEquals': otelCondition,
      },
      'sts:AssumeRoleWithWebIdentity'
    );
    
    role.assumeRolePolicy?.addStatements(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [otelPrincipal],
        actions: ['sts:AssumeRoleWithWebIdentity'],
      })
    );
  }

  addCloudwatchAddon() {
    // Apply federated principal to the cloudwatch addon role
    const openIdConnectProviderIssuer = this.cluster.openIdConnectProvider.openIdConnectProviderIssuer;
    const stringCondition = new CfnJson(this, `CloudwatchAddonOidcCondition`, {
      value: {
        [`${openIdConnectProviderIssuer}:aud`]: 'sts.amazonaws.com',
      },
    });

    const federatedPrincipal = new FederatedPrincipal(
      this.cluster.openIdConnectProvider.openIdConnectProviderArn,
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

    const addon = new CfnAddon(this, 'CloudWatchAddonAddon', {
      addonName: 'amazon-cloudwatch-observability',
      clusterName: this.cluster.clusterName,
      serviceAccountRoleArn: this.cloudwatchAddonRole.roleArn, 
      resolveConflicts: 'OVERWRITE',
    });

    return addon;
  }
}
