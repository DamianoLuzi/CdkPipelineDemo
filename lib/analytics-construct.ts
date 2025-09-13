import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

export class CdkAnalyticsConstruct extends Construct {
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.eventBus = new events.EventBus(this, 'AnalyticsEventBus', {
      eventBusName: 'AnalyticsEventBus',
    });

    const analyticsQueue = new sqs.Queue(this, 'AnalyticsSQSQueue', {
      retentionPeriod: cdk.Duration.days(4),
      visibilityTimeout: cdk.Duration.minutes(30),
    });

    const dlq = new sqs.Queue(this, 'AnalyticsDLQ', {
      retentionPeriod: cdk.Duration.days(14),
    });

    const analyticsBucket = new s3.Bucket(this, 'AnalyticsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const analyticsLambda = new lambda.Function(this, 'AnalyticsFunction', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'index.lambda_handler',
      timeout: cdk.Duration.minutes(5),
      code: lambda.Code.fromInline(`
import os
def lambda_handler(event, context):
    print('## EVENT')
    print(event)
        `),
      environment: {
        BUCKET_NAME: analyticsBucket.bucketName,
      },
      deadLetterQueue: dlq,
    });

    analyticsQueue.grantConsumeMessages(analyticsLambda);
    analyticsBucket.grantWrite(analyticsLambda);

    analyticsLambda.addEventSource(new lambdaEventSources.SqsEventSource(analyticsQueue, {
      batchSize: 10,
      maxBatchingWindow: cdk.Duration.seconds(10),
      reportBatchItemFailures: true, 
    }));

    new events.Rule(this, 'PostsEventsRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['posts.service'],
        detailType: ['PostCreated'],
      },
      targets: [new targets.SqsQueue(analyticsQueue)],
    });

    new events.Rule(this, 'ChatEventsRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['chat.service'],
        detailType: ['DynamoDB Stream Record'],
      },
      targets: [new targets.SqsQueue(analyticsQueue)],
    });

    new events.Rule(this, 'ChatMessageEventsRule', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['chat.service'],
        detailType: ['MessageSent', 'UserConnected', 'UserDisconnected'],
      },
      targets: [new targets.SqsQueue(analyticsQueue)],
    });
  }
}