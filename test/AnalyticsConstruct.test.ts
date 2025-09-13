import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CdkAnalyticsConstruct } from '../lib/analytics-construct';
import * as events from 'aws-cdk-lib/aws-events';
import { Stack } from 'aws-cdk-lib';

describe('CdkAnalyticsConstruct', () => {
  test('creates EventBus, SQS queues, Lambda, S3 bucket, and EventBridge rules', () => {
    const app = new cdk.App();
    const stack = new Stack(app, 'TestStack');
    new CdkAnalyticsConstruct(stack, 'AnalyticsConstruct');

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Events::EventBus', {
      Name: 'AnalyticsEventBus',
    });

    template.hasResourceProperties('AWS::SQS::Queue', {
      VisibilityTimeout: 1800,
    });

    template.hasResourceProperties('AWS::SQS::Queue', {
      MessageRetentionPeriod: 1209600,
    });

    template.hasResourceProperties('AWS::S3::Bucket', {
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'python3.13',
      Timeout: 300, 
      Environment: {
        Variables: {
          BUCKET_NAME: Match.anyValue(),
        },
      },
    });

    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        source: ['posts.service'],
        'detail-type': ['PostCreated'],
      },
      Targets: Match.arrayWith([
        Match.objectLike({ Arn: { 'Fn::GetAtt': Match.anyValue() } }),
      ]),
    });

    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        source: ['chat.service'],
        'detail-type': ['DynamoDB Stream Record'],
      },
      Targets: Match.arrayWith([
        Match.objectLike({ Arn: { 'Fn::GetAtt': Match.anyValue() } }),
      ]),
    });

    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        source: ['chat.service'],
        'detail-type': ['MessageSent', 'UserConnected', 'UserDisconnected'],
      },
      Targets: Match.arrayWith([
        Match.objectLike({ Arn: { 'Fn::GetAtt': Match.anyValue() } }),
      ]),
    });
  });
});
