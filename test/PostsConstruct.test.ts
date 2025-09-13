import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as events from 'aws-cdk-lib/aws-events';
import { CdkPostsConstruct } from '../lib/posts-contruct';
import { Stack } from 'aws-cdk-lib';

describe('CdkPostsConstruct', () => {
  test('creates REST API, DynamoDB table, Lambdas, and Pipe', () => {
    const app = new cdk.App();
    const stack = new Stack(app, 'TestStack');

    const eventBus = new events.EventBus(stack, 'AnalyticsBus');

    new CdkPostsConstruct(stack, 'PostsConstruct', { eventBus });

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: Match.arrayWith([
        Match.objectLike({ AttributeName: 'postId', KeyType: 'HASH' }),
        Match.objectLike({ AttributeName: 'createdAt', KeyType: 'RANGE' }),
      ]),
    });

    template.resourceCountIs('AWS::Lambda::Function', 2);
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    template.resourceCountIs('AWS::Pipes::Pipe', 1);
  });
});
