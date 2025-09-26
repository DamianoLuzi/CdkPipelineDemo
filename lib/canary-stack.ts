import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as synthetics from 'aws-cdk-lib/aws-synthetics';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';

interface CanaryStackProps extends cdk.StackProps {
  websocketUrl: string;
}

export class CanaryStack extends cdk.Stack {
  public readonly successAlarm: cloudwatch.Alarm;
  public readonly alarmTopic: sns.Topic;
  constructor(scope: Construct, id: string, props: CanaryStackProps) {
    super(scope, id, props);

    const artifactsBucket = new s3.Bucket(this, 'WebSocketCanaryArtifacts', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, 
      autoDeleteObjects: true,                  
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    const canaryRole = new iam.Role(this, 'WebSocketCanaryRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('synthetics.amazonaws.com'),
        new iam.ServicePrincipal('lambda.amazonaws.com')
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchSyntheticsFullAccess'),
      ],
    });

     canaryRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        "cloudwatch:PutMetricData",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ],
      resources: ["*"],
    }));

    artifactsBucket.grantWrite(canaryRole);
    artifactsBucket.grantRead(canaryRole);

    const canary = new synthetics.Canary(this, 'ChatApiCanary', {
      canaryName: 'wsmonitorcanary',
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_6_2,
      role: canaryRole,
      test: synthetics.Test.custom({
        code: synthetics.Code.fromAsset(path.join(__dirname,'../canary')),
        handler: 'canary-script.handler',
      }),
      schedule: synthetics.Schedule.rate(cdk.Duration.minutes(1)),
      timeout: cdk.Duration.minutes(1),
      environmentVariables: {
        CHAT_API_URL: props.websocketUrl,
        TEST_MESSAGE: 'canary test message',
      },
      artifactsBucketLocation: {
        bucket: artifactsBucket,
      },
    });

    const dashboard = new cloudwatch.Dashboard(this, 'CanaryDashboard', {
      dashboardName: 'ChatCanaryDashboard',
    });

    const successMetric = canary.metricSuccessPercent();
    const durationMetric = canary.metricDuration();
    const failedMetric = canary.metricFailed();

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Success Rate (%)',
        left: [successMetric],
      }),
      new cloudwatch.GraphWidget({
        title: 'Failures',
        left: [failedMetric],
      }),
      new cloudwatch.GraphWidget({
        title: 'Duration (ms)',
        left: [durationMetric],
      }),
    );

    const alarmTopic = new sns.Topic(this, 'CanaryAlarmTopic', {
      displayName: 'Chat Api Canary Alarms',
      topicName: 'ChatApiCanaryAlarmTopic',
    });
    
    alarmTopic.addToResourcePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.AccountPrincipal('718579638605')],
        actions: [
            'SNS:GetTopicAttributes',
            'SNS:ListSubscriptionsByTopic',
            'SNS:Subscribe'],
        resources: [alarmTopic.topicArn],
    }));

    alarmTopic.addToResourcePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudwatch.amazonaws.com')],
        actions: ['SNS:Publish'],
        resources: [alarmTopic.topicArn],
    }));

    alarmTopic.addSubscription(
      new subs.EmailSubscription('luzi.dami03@gmail.com')
    );
    
    this.alarmTopic = alarmTopic;
    
    this.successAlarm = new cloudwatch.Alarm(this, 'CanarySuccessAlarm', {
      metric: successMetric,
      threshold: 90,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      alarmDescription: 'Canary success rate below 90%',
    });

    this.successAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    new cloudwatch.Alarm(this, 'CanaryFailureAlarm', {
      metric: failedMetric,
      threshold: 1,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Canary detected failures',
    }).addAlarmAction(new actions.SnsAction(this.alarmTopic));

    new cloudwatch.Alarm(this, 'CanaryDurationAlarm', {
      metric: durationMetric,
      threshold: 10000,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Canary execution duration exceeded 10 seconds',
    }).addAlarmAction(new actions.SnsAction(this.alarmTopic));

    new cdk.CfnOutput(this, 'AlarmTopicArnOutput', {
      value: alarmTopic.topicArn,
      exportName: 'ChatApiCanaryAlarmTopicArn',
    });
  }
}
