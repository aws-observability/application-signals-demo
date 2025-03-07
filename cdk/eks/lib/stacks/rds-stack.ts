import { RemovalPolicy, Fn, Duration, CfnOutput } from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SubnetGroup, DatabaseCluster, DatabaseClusterEngine, AuroraPostgresEngineVersion, Credentials, PerformanceInsightRetention } from 'aws-cdk-lib/aws-rds';
import { InstanceType, InstanceClass, InstanceSize} from 'aws-cdk-lib/aws-ec2';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Vpc, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { DatabaseInsightsMode } from 'aws-cdk-lib/aws-rds';

interface RdsStackProps extends StackProps {
  vpc: Vpc;
  rdsSecurityGroup: SecurityGroup
}

export class RdsStack extends Stack {
  public readonly clusterEndpoint: string;
  private readonly securityGroup: SecurityGroup;
  private readonly rdsSubnetGroupName = 'eks-rds-subnet-group';
  private readonly dbClusterIdentifier = 'eks-petclinic-python';
  private readonly masterUsername = 'djangouser';
  private readonly secretName = 'petclinic-python-dbsecret';
  constructor(scope: Construct, id: string, props: RdsStackProps) {
    super(scope, id, props);

    const { vpc, rdsSecurityGroup } = props;
    this.securityGroup = rdsSecurityGroup;

    // Create a database subnet group
    const dbSubnetGroup = new SubnetGroup(this, 'EksDbSubnetGroup', {
      vpc: vpc,
      subnetGroupName: this.rdsSubnetGroupName,
      description: 'Subnet group for RDS',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const dbSecret = new Secret(this, 'EksDbSecret', {
      secretName: this.secretName,
      description: `Randomly generated password for ${this.dbClusterIdentifier} database`,
      generateSecretString: {
        passwordLength: 10,
        excludeCharacters: '/@" ',
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Create an Aurora PostgreSQL cluster
    const dbCluster = new DatabaseCluster(this, 'EksRdsCluster', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_15_4,
      }),
      credentials: Credentials.fromUsername(this.masterUsername, {
        password: dbSecret.secretValue,
      }),
      instances: 1,
      instanceProps: {
        instanceType: InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.MEDIUM),
        vpc,
      },
      subnetGroup: dbSubnetGroup,
      backup: {
        retention: Duration.days(1),
      },
      
      performanceInsightRetention: PerformanceInsightRetention.MONTHS_15,
      enablePerformanceInsights: true,
      databaseInsightsMode: DatabaseInsightsMode.ADVANCED,
      removalPolicy: RemovalPolicy.DESTROY,
      clusterIdentifier: this.dbClusterIdentifier,
      securityGroups: [this.securityGroup],
    });
    
    this.clusterEndpoint = dbCluster.clusterEndpoint.socketAddress.split(':')[0];
  }
}