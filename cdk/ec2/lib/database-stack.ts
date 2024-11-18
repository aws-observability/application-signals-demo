// lib/database-stack.ts

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  DatabaseInstance,
  DatabaseInstanceEngine,
  PostgresEngineVersion,
  Credentials,
  StorageType,
  SubnetGroup,
} from 'aws-cdk-lib/aws-rds';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { RemovalPolicy, Duration, CfnOutput } from 'aws-cdk-lib';

interface DatabaseStackProps extends cdk.StackProps {
  vpc: Vpc;
  rdsSecurityGroup: SecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  // Expose the database endpoint and credentials
  public readonly dbInstanceEndpoint: string;
  public readonly dbSecret: Secret;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { vpc, rdsSecurityGroup } = props;

    // Create a Secret for the database credentials
    this.dbSecret = new Secret(this, 'DBSecret', {
      secretName: 'PetClinicDBCredentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'root' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    // Create a Subnet Group for the RDS instance
    const subnetGroup = new SubnetGroup(this, 'DBSubnetGroup', {
      vpc,
      description: 'Subnet group for RDS instance',
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_NAT,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Create the RDS PostgreSQL instance
    const dbInstance = new DatabaseInstance(this, 'RDSInstance', {
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_14,
      }),
      instanceIdentifier: 'PetClinic-python',
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_NAT,
      },
      subnetGroup,
      securityGroups: [rdsSecurityGroup],
      credentials: Credentials.fromSecret(this.dbSecret),
      allocatedStorage: 20,
      maxAllocatedStorage: 25,
      storageType: StorageType.GP2,
      multiAz: false,
      publiclyAccessible: false,
      instanceType: cdk.aws_ec2.InstanceType.of(
        cdk.aws_ec2.InstanceClass.T3,
        cdk.aws_ec2.InstanceSize.MICRO,
      ),
      removalPolicy: RemovalPolicy.DESTROY,
      deleteAutomatedBackups: true,
      deletionProtection: false,
      backupRetention: Duration.days(0),
    });

    // Output the database endpoint and port
    new CfnOutput(this, 'DBEndpoint', {
      value: dbInstance.dbInstanceEndpointAddress,
      description: 'Endpoint address of the RDS instance',
      exportName: 'DBEndpoint',
    });

    new CfnOutput(this, 'DBPort', {
      value: dbInstance.dbInstanceEndpointPort,
      description: 'Endpoint port of the RDS instance',
      exportName: 'DBPort',
    });

    // Output the Secret ARN
    new CfnOutput(this, 'DBSecretArn', {
      value: this.dbSecret.secretArn,
      description: 'ARN of the database credentials secret',
      exportName: 'DBSecretArn',
    });
  }
}
