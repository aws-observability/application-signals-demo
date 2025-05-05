import * as path from 'path';
import { Construct } from 'constructs';
import { RemovalPolicy, Duration, StackProps, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { Role, RoleProps } from 'aws-cdk-lib/aws-iam';
import { Canary, Runtime, Code, Schedule, Test } from 'aws-cdk-lib/aws-synthetics';

interface SyntheticCanaryProps extends StackProps {
    vpc: Vpc,
    albEndpoint: string,
    syntheticCanaryRoleProp: RoleProps,
  }

export class SyntheticCanaryStack extends Stack {
  private readonly albEndpoint: string;
  private readonly syntheticCanaryRole: Role;
  private readonly vpc: Vpc;

  private readonly canaryScriptPath = path.join(__dirname, '..', 'canaries');

  // Canary Configuration
  private readonly canaryNameList: string[] = [
    'pc-add-visit',
    'pc-create-owners',
    'pc-visit-pet',
    'pc-visit-vet',
    'pet-clinic-traffic',
    'pc-visit-insurances',
    'pc-visit-billings',
    'pc-add-visit-rum',
    'pc-add-visit-error-rum',
    'pet-clinic-rum'
  ];
      
  constructor(scope: Construct, id: string, props: SyntheticCanaryProps) {
    super(scope, id, props);

    const { albEndpoint, syntheticCanaryRoleProp } = props;
    this.albEndpoint = albEndpoint;

    this.syntheticCanaryRole = new Role(this, 'EksClusterRole', syntheticCanaryRoleProp);

    const artifactBucket = new Bucket(this, 'CanaryArtifactBucket', {
      bucketName: `cw-syn-results-petclinic-${this.account}-${this.region}`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.canaryNameList.forEach((canaryName) => {
      new Canary(this, `${canaryName}-canary`, {
        canaryName: canaryName,
        role: this.syntheticCanaryRole,
        runtime: Runtime.SYNTHETICS_NODEJS_PUPPETEER_6_2,
        test: Test.custom({
          code: Code.fromAsset(path.join(this.canaryScriptPath, `${canaryName}`)),
          handler: `${canaryName}.handler`,
        }),
        artifactsBucketLocation: {
          bucket: artifactBucket,
        },
        schedule: Schedule.rate(Duration.minutes(1)),
        environmentVariables: {
          URL: `http://${this.albEndpoint}`,
        },
        startAfterCreation: true,
        vpc: this.vpc,
        activeTracing: true,
      });
    });
  }
}
