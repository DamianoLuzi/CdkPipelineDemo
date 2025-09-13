import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as pipes from 'aws-cdk-lib/aws-pipes';
import * as path from 'path';

interface CdkPostsConstructProps extends cdk.StackProps {
  eventBus: events.EventBus;
}
export class CdkPostsConstruct extends Construct {
  public readonly postsApi: apigateway.RestApi;
  public readonly postsTable: dynamodb.Table;
  constructor(scope: Construct, id: string, props: CdkPostsConstructProps) {
    super(scope, id);

    this.postsTable = new dynamodb.Table(this, 'PostsTable', {
      partitionKey: { name: 'postId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, 
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    const comprehendRole = new iam.Role(this, 'PostsLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    comprehendRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
            'comprehend:DetectTargetedSentiment',
            'comprehend:BatchDetectTargetedSentiment',
            'comprehend:DetectToxicContent',
        ],
        resources: ['*'],
      })
    );

    const postAnalysisFn = new lambda.Function(this, 'PostContentModerationFunction', {
      functionName: 'postModerationFunction',
      runtime: lambda.Runtime.PYTHON_3_13,
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset(path.join(__dirname, '..', `lambda/moderation`)),
      handler: 'handler.lambda_handler',
      memorySize: 128,
      timeout: Duration.seconds(3),
      role: comprehendRole,
      environment: {
        TABLE_NAME: this.postsTable.tableName,
        REGION: cdk.Stack.of(this).region
      }
    });
    const fetchPostsFn = new lambda.Function(this, 'FetchPostsFunction', {
      functionName: 'FetchPostsFunction',
      runtime: lambda.Runtime.PYTHON_3_13,
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset(path.join(__dirname, '..', `lambda/fetch`)),
      handler: 'handler.lambda_handler',
      memorySize: 128,
      timeout: Duration.seconds(3),
      role: comprehendRole,
      environment: {
        TABLE_NAME: this.postsTable.tableName,
        REGION: cdk.Stack.of(this).region
      }
    });

    this.postsApi = new apigateway.RestApi(this, 'PostsApi', {
      restApiName: 'PostsAPI',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
        allowMethods: ['POST', 'OPTIONS'],
      },
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
    });

    this.postsTable.grantWriteData(postAnalysisFn);
    this.postsTable.grantReadData(fetchPostsFn);

    const apiResource = this.postsApi.root.addResource('posts');
    apiResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(postAnalysisFn, {
        proxy: true,
      })
    );
    apiResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(fetchPostsFn, {
        proxy: true,
      })
    );

    postAnalysisFn.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    fetchPostsFn.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    new CfnOutput(this, 'PostsAPIEndpoint', {
      value: `${this.postsApi.url}review`,
    });

    const pipeRole = new iam.Role(this, 'PostsStreamPipeRole', {
      assumedBy: new iam.ServicePrincipal('pipes.amazonaws.com'),
    });

    pipeRole.addToPolicy(
        new iam.PolicyStatement({
            actions: [
                'dynamodb:DescribeStream',
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:ListStreams',
            ],
            resources: [this.postsTable.tableStreamArn!],
        })
    );
    pipeRole.addToPolicy(
      new iam.PolicyStatement({
          actions: ['events:PutEvents'],
          resources: [props.eventBus.eventBusArn],
      })
    );

    new pipes.CfnPipe(this, 'PostsStreamPipe', {
      name: `${cdk.Stack.of(this).stackName}-posts-stream-pipe`,
      roleArn: pipeRole.roleArn,
      source: this.postsTable.tableStreamArn!,
      target: props.eventBus.eventBusArn,
      sourceParameters: {
        dynamoDbStreamParameters: {
          startingPosition: 'LATEST',
          batchSize: 10,
          maximumBatchingWindowInSeconds: 5,
        },
      },
      targetParameters: {
        eventBridgeEventBusParameters: {
          detailType: 'DynamoDB Stream Record',
          source: 'posts.service',
        },
      },
    });
  }
}




