import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { PipelineStage } from './pipeline-stage';
import { AppStack } from './application-stack';

export class CdkPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const pipeline = new CodePipeline(this,"Pipeline", {
      pipelineName: 'DemoCodePipeline',
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.connection(
          'DamianoLuzi/CdkPipelineDemo','main',{
            connectionArn: 'arn:aws:codeconnections:us-east-1:718579638605:connection/500ced3a-c591-4bad-9545-b6d2b66de1c3',
            triggerOnPush: true
          }
        ),
        commands: [
          'npm ci',
          'npm run build',
          'npx cdk synth',
        ],
      }),
      crossAccountKeys: true
    });

    const devStage =  new PipelineStage(this, 'DEV', {env: { account: '799201157016', region: 'eu-west-3' }});

    pipeline.addStage(devStage, {
      pre: [
        new ShellStep('UnitTests', {
          commands: [
            'npm ci',
            'npm test',
          ],
        }),
      ],
    });

  //   const stgStage = new PipelineStage(this, 'STG', {env: { account: '351323459405', region: 'eu-central-1' }})
  //   const appStack = stgStage.node.tryFindChild('CommunityHubStack') as AppStack;

  //   pipeline.addStage(stgStage, {
  //     post: [
  //       new ShellStep('RunIntegrationTests', {
  //         commands: [
  //         'echo "Testing REST API..."',
  //         'curl -Ssf $POSTS_API_URL/posts || exit 1',
  //         'echo "Testing WebSocket API..."',
  //         'npm ci',
  //         `npx ts-node test/test.websocket.ts $CHAT_API_URL "normal message"|| exit 1`,
  //         // Test with the "bug" message to simulate failure
  //         // `npx ts-node test/test.websocket.ts $CHAT_API_URL "fail"|| exit 1`
  //         ],
  //         envFromCfnOutputs: {
  //             POSTS_API_URL: appStack.node.tryFindChild('PostsApiUrl') as cdk.CfnOutput,
  //             CHAT_API_URL: appStack.node.tryFindChild('ChatApiUrl') as cdk.CfnOutput,
  //         },
  //       })
  //     ],
  //  });
}
}