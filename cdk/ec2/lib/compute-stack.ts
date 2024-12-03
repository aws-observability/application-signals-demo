import * as crypto from 'crypto';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  Vpc,
  InstanceType,
  InstanceClass,
  InstanceSize,
  MachineImage,
  SecurityGroup,
  SubnetType,
  Instance,
  UserData,
  LaunchTemplate
} from 'aws-cdk-lib/aws-ec2';
import { Role } from 'aws-cdk-lib/aws-iam';
import { PrivateHostedZone, ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';

interface ComputeStackProps extends cdk.StackProps {
  vpc: Vpc;
  ec2SecurityGroup: SecurityGroup;
  ec2InstanceRole: Role;
  hostedZone: PrivateHostedZone;
  dbSecretArn: string;
}

export class ComputeStack extends cdk.Stack {
  public frontendInstance: Instance;
  public visitsAsg: AutoScalingGroup;
  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { vpc, ec2SecurityGroup, ec2InstanceRole, hostedZone, dbSecretArn } = props;

    // Import the database secret
    const dbSecret = Secret.fromSecretCompleteArn(this, 'DBSecret', dbSecretArn);

    // Grant the EC2 instance role permission to read the secret
    dbSecret.grantRead(ec2InstanceRole);

    // Define common properties for all instances
    const instanceType = InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM);
    const machineImage = MachineImage.latestAmazonLinux2023({});
    const vpcSubnets = { subnetType: SubnetType.PRIVATE_WITH_NAT };

    // List of services to deploy
    const services = [
      { name: 'setup', script: 'setup-user-data.sh', useAsg: false },
      { name: 'pet-clinic-frontend', script: 'pet-clinic-frontend-user-data.sh', useAsg: false },
      { name: 'vets', script: 'vets-user-data.sh', useAsg: false },
      { name: 'customers', script: 'customers-user-data.sh', useAsg: false },
      { name: 'insurances', script: 'insurances-user-data.sh', useAsg: false },
      { name: 'billings', script: 'billings-user-data.sh', useAsg: false },
      { name: 'payments', script: 'payments-user-data.sh', useAsg: false },
      { name: 'visits', script: 'visits-user-data.sh', useAsg: true },
    ];

    services.forEach((service) => {
      // Read the user data script from file
      let userDataScript = readFileSync(join(__dirname, 'user-data', service.script), 'utf8');

      // Compute a hash of the User Data
      const userDataHash = crypto.createHash('sha256').update(userDataScript).digest('hex');

      const userData = UserData.forLinux();
      userData.addCommands(userDataScript);
      if (service.useAsg) {
        // Create a Launch Template for the visits service
        const launchTemplate = new LaunchTemplate(this, `${service.name}LaunchTemplate`, {
          launchTemplateName: `${service.name}-launch-template`,
          machineImage,
          instanceType,
          securityGroup: ec2SecurityGroup,
          role: ec2InstanceRole,
          userData,
        });

        // Create an Auto Scaling Group for the visits service
        const asg = new AutoScalingGroup(this, `${service.name}ASG`, {
          autoScalingGroupName: `${service.name}-asg`,
          vpc,
          vpcSubnets,
          minCapacity: 1,
          maxCapacity: 1,
          desiredCapacity: 1,
          launchTemplate,
        });


        // Save the visits ASG for potential use in other stacks
        if (service.name === 'visits') {
          this.visitsAsg = asg;
        }

        // Output the ASG Name
        new cdk.CfnOutput(this, `${service.name}ASGName`, {
          value: asg.autoScalingGroupName,
          description: `Auto Scaling Group Name for the ${service.name} service`,
        });

      } else {

        // Create the EC2 instance
        const instance = new Instance(this, `${service.name}Instance-${userDataHash.substring(0, 8)}`, {
          instanceName: `${service.name}-instance`,
          vpc,
          instanceType,
          machineImage,
          securityGroup: ec2SecurityGroup,
          role: ec2InstanceRole,
          userData,
          vpcSubnets,
        });

        if (service.name === 'pet-clinic-frontend') {
          this.frontendInstance = instance;
        }

        // Create Route 53 A Record
        new ARecord(this, `${service.name}DNSRecord`, {
          zone: hostedZone,
          recordName: `${service.name}`,
          target: RecordTarget.fromIpAddresses(instance.instancePrivateIp),
        });

        // Output the instance ID and DNS name
        new cdk.CfnOutput(this, `${service.name}InstanceID`, {
          value: instance.instanceId,
          description: `Instance ID of the ${service.name} service`,
        });

        new cdk.CfnOutput(this, `${service.name}PrivateIP`, {
          value: instance.instancePrivateIp,
          description: `Private IP of the ${service.name} service`,
        });
      }
    });
  }
}
