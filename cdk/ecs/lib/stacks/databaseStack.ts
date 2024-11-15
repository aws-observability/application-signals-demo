import { Construct } from 'constructs';
import {
    DatabaseInstance,
    SubnetGroup,
    Credentials,
    DatabaseInstanceEngine,
    PostgresEngineVersion,
    StorageType,
} from 'aws-cdk-lib/aws-rds';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StackProps, Stack, CfnOutput, Duration, RemovalPolicy, Tags } from 'aws-cdk-lib';
import { Vpc, SecurityGroup, SubnetType, InstanceType, InstanceClass, InstanceSize } from 'aws-cdk-lib/aws-ec2';

interface RdsDatabaseStackProps extends StackProps {
    readonly vpc: Vpc;
    readonly rdsSecurityGroup: SecurityGroup;
}

export class RdsDatabaseStack extends Stack {
    private readonly vpc: Vpc;
    private readonly DB_INSTANCE_IDENTIFIER: string = 'petclinic-python';
    public readonly rdsInstance: DatabaseInstance;
    public readonly dbSecret: Secret;

    constructor(scope: Construct, id: string, props: RdsDatabaseStackProps) {
        super(scope, id, props);

        this.vpc = props.vpc;

        // Create DB Subnet Group
        const dbSubnetGroup = new SubnetGroup(this, 'MyDBSubnetGroup', {
            vpc: this.vpc,
            description: 'Subnet group for RDS',
            subnetGroupName: 'my-db-subnet-group',
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_ISOLATED, // Ensure private subnets with NAT are used
            },
            removalPolicy: RemovalPolicy.DESTROY,
        });

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

        // Create database instance
        this.rdsInstance = new DatabaseInstance(this, 'MyDatabase', {
            vpc: this.vpc,
            credentials: Credentials.fromSecret(this.dbSecret),
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE_ISOLATED, // Ensure private subnets with NAT are used
            },
            publiclyAccessible: false,
            instanceIdentifier: this.DB_INSTANCE_IDENTIFIER,
            instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO), // db.t3.micro
            engine: DatabaseInstanceEngine.postgres({
                version: PostgresEngineVersion.VER_14,
            }),
            allocatedStorage: 20, // 20 GB allocated storage
            maxAllocatedStorage: 25,
            storageType: StorageType.GP2,
            subnetGroup: dbSubnetGroup,
            securityGroups: [props.rdsSecurityGroup],
            multiAz: false, // Disable Multi-AZ
            backupRetention: Duration.days(0), // 0 days backup retention
            removalPolicy: RemovalPolicy.DESTROY, // For dev/testing environments
            deletionProtection: false, // Disable deletion protection
            deleteAutomatedBackups: true,
        });

        Tags.of(this.rdsInstance).add('Name', this.DB_INSTANCE_IDENTIFIER);

        // Output the subnet group name
        new CfnOutput(this, 'DBSubnetGroupName', {
            value: dbSubnetGroup.subnetGroupName,
        });
    }
}
