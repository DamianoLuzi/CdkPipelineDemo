import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { PipelineStage } from './pipeline-stage';
import { AppStack } from './application-stack';
import * as synthetics from 'aws-cdk-lib/aws-synthetics';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import path from 'path';

export class CdkPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const pipeline = new CodePipeline(this, "Pipeline", {
      pipelineName: 'DemoCodePipeline',
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.connection(
          'DamianoLuzi/CdkPipelineDemo', 'main', {
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

    const devStage = new PipelineStage(this, 'DEV', { env: { account: '799201157016', region: 'eu-west-3' } });

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

    const stgStage = new PipelineStage(this, 'STG', { env: { account: '351323459405', region: 'eu-central-1' } })

    pipeline.addStage(stgStage, {
      post: [
        new ShellStep('RunIntegrationTests', {
          commands: [
            'npm ci',
            'echo "Testing WebSocket API..."',
            `npx ts-node test/test.websocket.ts $CHAT_API_URL "test message"|| exit 1`,
            'npm run integ',
            // Test with the "bug" message to simulate failure
            // `npx ts-node test/test.websocket.ts $CHAT_API_URL "fail"|| exit 1`
          ],
          envFromCfnOutputs: {
            CHAT_API_URL: stgStage.appUrlOutput
          },
        })
      ],
    });

    // const prodStage = new PipelineStage(this, 'PROD', {
    //   env: { account: '410431259391', region: 'eu-south-1' }
    // });

    // pipeline.addStage(prodStage, {
    //   post: [
    //     new ShellStep('RunPostDeployTests', {
    //       commands: [
    //         'npm ci',
    //         `npx ts-node test/test.websocket.ts $CHAT_API_URL "test message" || exit 1`,
    //       ],
    //       envFromCfnOutputs: { CHAT_API_URL: prodStage.appUrlOutput }
    //     }),
    //   ],
    // });

    // const prodCanary = new synthetics.Canary(this, 'ProdWebSocketCanary', {
    //   canaryName: 'prod-websocket-canary',
    //   runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_6_2,
    //   test: synthetics.Test.custom({
    //     code: synthetics.Code.fromAsset(path.join(__dirname, '..','canary')),
    //     handler: 'index.handler',
    //   }),
    //   schedule: synthetics.Schedule.rate(cdk.Duration.minutes(5)),
    //   environmentVariables: { 
    //     CHAT_API_URL: prodStage.appUrlOutput.toString(),
    //     TEST_MESSAGE: 'broadcast-test',
    //    },
    // });

    // const prodCanaryAlarm = new cloudwatch.Alarm(this, 'ProdCanaryAlarm', {
    //   metric: prodCanary.metricSuccessPercent(),
    //   threshold: 90,
    //   evaluationPeriods: 1,
    //   comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    //   alarmDescription: 'Production WebSocket Canary Alarm',
    // });
    // const prodSnsTopic = new sns.Topic(this, 'ProdCanarySnsTopic');
    // prodSnsTopic.addSubscription(new subscriptions.EmailSubscription('luzi.dami03@gmail.com'));

    // prodCanaryAlarm.addAlarmAction(new actions.SnsAction(prodSnsTopic));

  }
}