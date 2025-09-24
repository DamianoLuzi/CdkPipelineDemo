import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";

interface RollbackLambdaStackProps extends cdk.StackProps {
  alarmTopicArn: string;
  pipelineName: string;
  stageName: string;
  targetAccount: string; 
  region: string;
}

export class RollbackLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RollbackLambdaStackProps) {
    super(scope, id, props);

    const rollbackLambda = new lambda.Function(this, "RollbackLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/rollback"),
      environment: {
        PIPELINE_NAME: props.pipelineName,
        STAGE_NAME: props.stageName,
        TARGET_ACCOUNT: props.targetAccount,
        REGION: props.region,
      },
    });

    rollbackLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "codepipeline:ListPipelineExecutions",
          "codepipeline:GetPipelineExecution",
          "codepipeline:RollbackStage",
        ],
        resources: [`arn:aws:codepipeline:${props.region}:${props.targetAccount}:${props.pipelineName}`],
      })
    );

    const topic = sns.Topic.fromTopicArn(this, "AlarmTopic", props.alarmTopicArn);

    rollbackLambda.addPermission('AllowSNSInvoke', {
    principal: new iam.ServicePrincipal('sns.eu-south-1.amazonaws.com'), //sns.<region>.amazonaws.com for cross region invoke
    sourceArn: props.alarmTopicArn,
    });

    topic.addSubscription(new subs.LambdaSubscription(rollbackLambda));
  }
}
