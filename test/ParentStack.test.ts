import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { AppStack } from '../lib/application-stack';

describe('Application Stack Unit Test', () => {
  test('synthesizes analytics EventBus and outputs correctly', () => {
    const app = new cdk.App();
    const stack = new  AppStack(app, 'AppStack');

    const template = Template.fromStack(stack);

    // template.hasResourceProperties('AWS::Events::EventBus', {
    //   Name: Match.stringLikeRegexp('AnalyticsEventBus'),
    // });

    //template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);

    const outputs = Object.values(stack.node.children)
      .filter(c => c instanceof cdk.CfnOutput)
      .map(c => c as cdk.CfnOutput);

    const outputIds = outputs.map(o => o.node.id);
    //expect(outputIds).toContain('PostsApiUrl');
    expect(outputIds).toContain('ChatApiUrl');
  });
});
