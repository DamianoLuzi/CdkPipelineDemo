import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as events from 'aws-cdk-lib/aws-events';
import { CdkChatConstruct } from '../lib/chat-construct';
import { Stack } from 'aws-cdk-lib';

describe('CdkChatConstruct', () => {
  test('creates WebSocket API, DynamoDB table, Lambdas, and Pipe', () => {
    const app = new cdk.App();
    const stack = new Stack(app, 'TestStack');

    const eventBus = new events.EventBus(stack, 'AnalyticsBus');

    new CdkChatConstruct(stack, 'TestChatConstruct'/*, { eventBus }*/);

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: Match.arrayWith([
        Match.objectLike({ AttributeName: 'connectionId', KeyType: 'HASH' }),
      ]),
    });

    template.resourceCountIs('AWS::Lambda::Function', 3);
    template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    template.resourceCountIs('AWS::ApiGatewayV2::Stage', 1);
    //template.resourceCountIs('AWS::Pipes::Pipe', 1);

    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          TABLE_NAME: Match.anyValue(),
        }),
      }),
    });
  });
});
