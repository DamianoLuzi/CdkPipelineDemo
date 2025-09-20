import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkChatConstruct } from './chat-construct';


export class AppStack extends cdk.Stack {
  public readonly urlOutput: cdk.CfnOutput;
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const chatApp = new CdkChatConstruct(this, 'ChatConstruct');
    
    this.urlOutput = new cdk.CfnOutput(this, 'ChatApiUrl', {
      value: chatApp.stage.url,
      description: 'The URL for the Chat WebSocket API',
    });
  }
}
