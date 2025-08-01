import * as cdk from 'aws-cdk-lib';
import { aws_bedrock as bedrock } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_opensearchserverless as opensearchserverless } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { custom_resources } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { Duration } from 'aws-cdk-lib';


export class KnowledgeBaseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create IAM role for the knowledge base
    const knowledgeBaseRole = new iam.Role(this, 'AppSignalsKnowledgeBaseRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Role for Application Signals knowledge base',
    });

    // Add permissions to the role
    knowledgeBaseRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'bedrock:*',
          'aoss:*', // For OpenSearch Serverless
          'iam:PassRole'
        ],
        resources: ['*'],
        effect: iam.Effect.ALLOW,
      })
    );

    // Create security policies for OpenSearch Serverless collection
    const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'AppSignalsKBEncryptionPolicy', {
      name: 'app-signals-kb-encryption-policy',
      type: 'encryption',
      description: 'Encryption policy for App Signals knowledge base collection',
      policy: JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: ['collection/app-signals-kb-collection']
          }
        ],
        AWSOwnedKey: true
      })
    });
    
    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'AppSignalsKBNetworkPolicy', {
      name: 'app-signals-kb-network-policy',
      type: 'network',
      description: 'Network policy for App Signals knowledge base collection',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: ['collection/app-signals-kb-collection']
            }
          ],
          AllowFromPublic: true
        }
      ])
    });
    
    // Create the OpenSearch Serverless collection
    const collection = new opensearchserverless.CfnCollection(this, 'AppSignalsKBCollection', {
      name: 'app-signals-kb-collection',
      type: 'VECTORSEARCH'
    });
    
    // Add dependencies to ensure security policies are created first
    collection.addDependsOn(encryptionPolicy);
    collection.addDependsOn(networkPolicy);
    
    // Create a data access policy for the collection
    const dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'AppSignalsKBDataAccessPolicy', {
      name: 'app-signals-kb-data-policy',
      type: 'data',
      description: 'Data access policy for App Signals knowledge base collection',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: ['collection/app-signals-kb-collection'],
              Permission: ['aoss:*']
            }
          ],
          Principal: [
            knowledgeBaseRole.roleArn,
            `arn:aws:iam::${cdk.Stack.of(this).account}:root`,
            `arn:aws:iam::${cdk.Stack.of(this).account}:role/aws-service-role/observability.aoss.amazonaws.com/AWSServiceRoleForAmazonOpenSearchServerless`
          ]
        }
      ])
    });

    // Add dependency to ensure collection is created first
    dataAccessPolicy.addDependsOn(collection);
    
    // Create a data access policy specifically for the index
    const indexAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'AppSignalsKBIndexAccessPolicy', {
      name: 'app-signals-kb-index-policy',
      type: 'data',
      description: 'Data access policy for App Signals knowledge base index',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'index',
              Resource: ['index/app-signals-kb-collection/*'],
              Permission: ['aoss:*']
            }
          ],
          Principal: [
            knowledgeBaseRole.roleArn,
            `arn:aws:iam::${cdk.Stack.of(this).account}:root`,
            `arn:aws:iam::${cdk.Stack.of(this).account}:role/aws-service-role/observability.aoss.amazonaws.com/AWSServiceRoleForAmazonOpenSearchServerless`
          ]
        }
      ])
    });
    
    // Add dependency to ensure collection is created first
    indexAccessPolicy.addDependsOn(collection);
    
    // Create the vector index in the OpenSearch Serverless collection
    const vectorIndex = new opensearchserverless.CfnIndex(this, 'AppSignalsKBIndex', {
      indexName: 'app-signals-kb-index',
      collectionEndpoint: collection.attrCollectionEndpoint,
      settings: {
        index: {
          knn: true
        }
      },
      // Use correctly formatted mappings with JSON string for OpenSearch mapping definition
      mappings: {
        properties: {
          embedding: {
            type: 'knn_vector',
            dimension: 1024,
            method: {
              name: 'hnsw',
              engine: 'faiss',
              spaceType: 'innerproduct',
              parameters: {
                efConstruction: 128,
                m: 16
              }
            }
          },
          text_content: {
            type: 'text'
          }
        }
      }
    });
    
    // Add dependencies to ensure access policies are created first
    vectorIndex.addDependsOn(dataAccessPolicy);
    vectorIndex.addDependsOn(indexAccessPolicy);

    // Simple delay resource to wait for vector index to be fully ready
    const waitForIndex = new cdk.CustomResource(this, 'WaitForVectorIndex', {
      serviceToken: new custom_resources.Provider(this, 'DelayProvider', {
        onEventHandler: new lambda.Function(this, 'DelayFunction', {
          runtime: lambda.Runtime.NODEJS_18_X,
          handler: 'index.handler',
          code: lambda.Code.fromInline(`
            exports.handler = async (event) => {
              console.log('Waiting for 5 minutes to ensure OpenSearch resources are ready');
              
              // Just return immediately for delete/update events
              if (event.RequestType !== 'Create') {
                return {
                  PhysicalResourceId: event.PhysicalResourceId || 'delay-resource',
                  Data: {}
                };
              }
              
              // For create events, return a promise that resolves after the delay
              return new Promise((resolve) => {
                setTimeout(() => {
                  resolve({
                    PhysicalResourceId: 'delay-resource-' + Date.now().toString(),
                    Data: {}
                  });
                }, 300000); // 3 minutes in milliseconds
              });
            };
          `),
          timeout: Duration.minutes(10),  // Make sure Lambda timeout is greater than our delay
          memorySize: 128
        }),
      }).serviceToken
    });
    
    // Make sure we only wait after the CFN index resource is created
    waitForIndex.node.addDependency(vectorIndex);
    
    // Create the knowledge base for Application Signals with Vector store type
    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'AppSignalsKnowledgeBase', {
      name: 'appsignals_llm_knowledgebase',
      description: 'Knowledge base for AWS Application Signals documentation',
      roleArn: knowledgeBaseRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: 'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0',
        }
      },
      // You must choose a vector store; here we let Bedrock manage it via the default serverless OpenSearch collection
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: collection.attrArn,
          fieldMapping: {
            vectorField: 'embedding',
            textField: 'text_content',
            metadataField: 'metadata'
          },
          vectorIndexName: 'app-signals-kb-index'
        },
      },
    });

    // Then make the KB wait for the “waitForIndex” step
    (knowledgeBase as cdk.CfnResource).node.addDependency(waitForIndex);

    // Create an S3 bucket for the data source
    const bucket = new cdk.aws_s3.Bucket(this, 'AppSignalsDocsSourceBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false
    });
    
    // Give the knowledge base role access to the S3 bucket
    bucket.grantReadWrite(knowledgeBaseRole);
    
    // Create a basic data source using S3
    const dataSource = new bedrock.CfnDataSource(this, 'AppSignalsDataSource', {
      name: 'knowledge-base-quick-start',
      description: 'S3 data source for Application Signals documentation',
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: bucket.bucketArn,
          bucketOwnerAccountId: cdk.Stack.of(this).account
        }
      }
    });

    // Add dependency to ensure the knowledge base is created before the data source
    dataSource.addDependency(knowledgeBase);
    
    // Add dependencies to ensure the collection and index are created before the knowledge base
    knowledgeBase.addDependsOn(collection);
    knowledgeBase.addDependsOn(vectorIndex);

    // Output the knowledge base ID, data source ID, and bucket information
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: knowledgeBase.attrKnowledgeBaseId,
      description: 'The ID of the Application Signals knowledge base',
      exportName: 'AppSignalsKnowledgeBaseId'
    });

    new cdk.CfnOutput(this, 'DataSourceId', {
      value: dataSource.attrDataSourceId,
      description: 'The ID of the Application Signals knowledge base data source',
      exportName: 'AppSignalsDataSourceId'
    });
    
    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: bucket.bucketName,
      description: 'The S3 bucket where documentation content should be uploaded',
      exportName: 'AppSignalsDocsBucketName'
    });
    
    new cdk.CfnOutput(this, 'DocumentsBucketArn', {
      value: bucket.bucketArn,
      description: 'The ARN of the S3 bucket for documentation content',
      exportName: 'AppSignalsDocsBucketArn'
    });
  }
}
