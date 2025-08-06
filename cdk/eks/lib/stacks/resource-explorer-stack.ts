import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as resourceexplorer2 from 'aws-cdk-lib/aws-resourceexplorer2';

export class ResourceExplorerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create Resource Explorer Index
    const index = new resourceexplorer2.CfnIndex(this, 'ResourceExplorerIndex', {
      type: 'AGGREGATOR',
      tags: {
        Name: 'PetClinic-ResourceExplorer-Index',
        Project: 'AWS-Application-Signals-Demo'
      }
    });

    // Create a view for all resources in the account
    new resourceexplorer2.CfnView(this, 'AllResourcesView', {
      viewName: 'PetClinic-All-Resources',
      includedProperties: [
        {
          name: 'tags'
        }
      ],
      tags: {
        Name: 'PetClinic-All-Resources-View',
        Project: 'AWS-Application-Signals-Demo'
      }
    }).addDependency(index);
  }
}