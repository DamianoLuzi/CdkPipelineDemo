import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as synthetics from 'aws-cdk-lib/aws-synthetics';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as s3 from 'aws-cdk-lib/aws-s3';

interface CanaryStackProps extends cdk.StackProps {
  websocketUrl: string;
}

export class CanaryStack extends cdk.Stack {
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

    console.log(path.join(__dirname,'..','canary'))
    new synthetics.Canary(this, 'WebSocketCanary', {
      canaryName: 'wscanarymonitor',
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_6_2,
      role: canaryRole,
      test: synthetics.Test.custom({
        code: synthetics.Code.fromAsset(path.join(__dirname,'../canary')),
        handler: 'canary-script.handler',
      }),
      schedule: synthetics.Schedule.rate(cdk.Duration.minutes(5)),
      timeout: cdk.Duration.minutes(1),
      environmentVariables: {
        CHAT_API_URL: props.websocketUrl,
        TEST_MESSAGE: 'broadcast-test',
      },
      artifactsBucketLocation: {
        bucket: artifactsBucket,
      },
    });
  }
}
