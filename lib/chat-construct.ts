import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as events from 'aws-cdk-lib/aws-events';
import * as pipes from 'aws-cdk-lib/aws-pipes';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
// interface CdkChatConstructProps extends cdk.StackProps {
//     eventBus: events.EventBus;
// }
export class CdkChatConstruct extends Construct {

    public readonly chatApi: apigwv2.WebSocketApi;
    public readonly stage: apigwv2.WebSocketStage;
    public readonly table: dynamodb.Table;
    public readonly sendMessageLambda: lambda.Function;
    public readonly connectLambda: lambda.Function;
    public readonly disconnectLambda: lambda.Function;

    constructor(scope: Construct, id: string /*, props: CdkChatConstructProps*/) {
        super(scope, id);

        this.table = new dynamodb.Table(this, 'ConnectionsTable', {
            partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
        });

        const makeLambda = (id: string, timeoutSec: number) => {
            return new lambda.Function(this, id, {
                runtime: lambda.Runtime.PYTHON_3_13,
                handler: `handler.lambda_handler`,
                code: lambda.Code.fromAsset(path.join(__dirname, '..', `lambda/${id}`)),
                environment: { TABLE_NAME: this.table.tableName },
                timeout: cdk.Duration.seconds(timeoutSec),
                architecture: lambda.Architecture.ARM_64,
                functionName: `${id}Lambda-${cdk.Stack.of(this).stackName}`,
            });
            // new logs.LogGroup(this, `${id}LogGroup`, {
            //     logGroupName: `/aws/lambda/${id}-${cdk.Stack.of(this).stackName}`,
            //     removalPolicy: cdk.RemovalPolicy.DESTROY,
            //     retention: logs.RetentionDays.ONE_WEEK,
            // });
        };

        this.connectLambda = makeLambda('connect', 10);
        this.sendMessageLambda = makeLambda('sendmessage', 10);
        this.disconnectLambda = makeLambda('disconnect', 10);

        this.table.grantWriteData(this.connectLambda);
        this.table.grantWriteData(this.disconnectLambda);
        this.table.grantReadWriteData(this.sendMessageLambda);

        this.sendMessageLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['execute-api:ManageConnections'],
            resources: ['*'],
        }));

        this.chatApi = new apigwv2.WebSocketApi(this, 'ChatApi', {
            apiName: `${cdk.Stack.of(this).stackName}-chat-api`,
            routeSelectionExpression: '$request.body.action',
            connectRouteOptions: {
                integration: new integrations.WebSocketLambdaIntegration('ConnectIntegration', this.connectLambda),
            },
            disconnectRouteOptions: {
                integration: new integrations.WebSocketLambdaIntegration('DisconnectIntegration', this.disconnectLambda),
            },
        });

        this.chatApi.addRoute('sendmessage', {
            integration: new integrations.WebSocketLambdaIntegration('SendIntegration', this.sendMessageLambda),
        });

        this.stage = new apigwv2.WebSocketStage(this, 'ChatApiStage', {
            webSocketApi: this.chatApi,
            stageName: 'production',
            autoDeploy: true,
        });

        [this.connectLambda, this.disconnectLambda, this.sendMessageLambda].forEach(fn => {
            fn.addPermission(`${fn.node.id}InvokePermission`, {
                principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
                action: 'lambda:InvokeFunction',
                sourceArn: `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${this.chatApi.apiId}/${this.stage.stageName}/*/*`,
            });
        });

        const apiDomain = `https://${this.chatApi.apiId}.execute-api.${cdk.Stack.of(this).region}.amazonaws.com/${this.stage.stageName}`;
        this.sendMessageLambda.addEnvironment('CALLBACK_URL', apiDomain);


        // const pipeRole = new iam.Role(this, 'ChatStreamPipeRole', {
        //     assumedBy: new iam.ServicePrincipal('pipes.amazonaws.com'),
        //     inlinePolicies: {
        //         PipePolicy: new iam.PolicyDocument({
        //             statements: [
        //                 new iam.PolicyStatement({
        //                     effect: iam.Effect.ALLOW,
        //                     actions: [
        //                         'dynamodb:DescribeStream',
        //                         'dynamodb:GetRecords',
        //                         'dynamodb:GetShardIterator',
        //                         'dynamodb:ListStreams',
        //                     ],
        //                     resources: [this.table.tableStreamArn!],
        //                 }),
        //                 new iam.PolicyStatement({
        //                     effect: iam.Effect.ALLOW,
        //                     actions: ['events:PutEvents'],
        //                     resources: [props.eventBus.eventBusArn],
        //                 }),
        //             ],
        //         }),
        //     },
        // });

        // new pipes.CfnPipe(this, 'ChatStreamPipe', {
        //     name: `${cdk.Stack.of(this).stackName}-chat-stream-pipe`,
        //     roleArn: pipeRole.roleArn,
        //     source: this.table.tableStreamArn!,
        //     target: props.eventBus.eventBusArn,
        //     sourceParameters: {
        //         dynamoDbStreamParameters: {
        //             startingPosition: 'LATEST',
        //             batchSize: 10,
        //             maximumBatchingWindowInSeconds: 5,
        //         },
        //     },
        //     targetParameters: {
        //         eventBridgeEventBusParameters: {
        //             detailType: 'DynamoDB Stream Record',
        //             source: 'chat.service',
        //         },
        //     },
        // });
    }
}





