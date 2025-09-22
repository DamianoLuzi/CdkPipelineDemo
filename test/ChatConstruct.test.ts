import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CdkChatConstruct } from '../lib/chat-construct';
import { Stack } from 'aws-cdk-lib';

describe('CdkChatConstruct', () => {
  test('creates WebSocket API, DynamoDB table, Lambdas', () => {
    const app = new cdk.App();
    const stack = new Stack(app, 'TestStack');

    new CdkChatConstruct(stack, 'TestChatConstruct');

    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: Match.arrayWith([
        Match.objectLike({ AttributeName: 'connectionId', KeyType: 'HASH' }),
      ]),
    });

    template.resourceCountIs('AWS::Lambda::Function', 3);
    template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    template.resourceCountIs('AWS::ApiGatewayV2::Stage', 1);

    template.hasResourceProperties('AWS::ApiGatewayV2::Integration', {
      IntegrationType: 'AWS_PROXY',
      IntegrationUri: {
        'Fn::Join': [
          '',
          [
            'arn:',
            { 'Ref': 'AWS::Partition' },
            ':apigateway:',
            { 'Ref': 'AWS::Region' },
            ':lambda:path/2015-03-31/functions/',
            Match.objectLike({ 'Fn::GetAtt': [Match.stringLikeRegexp('connect'), 'Arn'] }),
            '/invocations'
          ]
        ]
      },
    });

    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: '$connect',
    });

    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'sendmessage',
    });

    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'execute-api:ManageConnections',
            Effect: 'Allow',
            Resource: {
              'Fn::Join': [
                '',
                Match.arrayWith([
                  Match.objectLike({ Ref: Match.stringLikeRegexp('ChatApi') }),
                  '/production/*',
                ]),
              ],
            },
          }),
        ]),
      },
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: Match.stringLikeRegexp('sendmessageLambda'),
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          CALLBACK_URL: {
            'Fn::Join': [
              '',
              Match.arrayWith([
                'https://',
                { Ref: Match.stringLikeRegexp('ChatApi') },
                '.execute-api.',
                { Ref: 'AWS::Region' },
                '.amazonaws.com/production',
              ]),
            ],
          },
        }),
      }),
    });
  });
});
