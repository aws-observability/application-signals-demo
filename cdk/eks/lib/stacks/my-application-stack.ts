import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CfnApplication } from 'aws-cdk-lib/aws-servicecatalogappregistry';

export class MyApplicationStack extends Stack {
    public application: CfnApplication
    constructor(scope: Construct, id: string) {
        super(scope, id, {});

        // Create a new Application using the L1 construct
        this.application = new CfnApplication(this, `EksJavaDemoApp`, {
            description: 'Created by CDK',
            name: `EksJavaDemoApp`,
        });
    }
}