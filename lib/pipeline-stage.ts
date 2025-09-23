import { Stage, StageProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import { AppStack } from "./application-stack";
import { CanaryStack } from "./canary-stack";

export class PipelineStage extends Stage {
    public readonly appUrlOutput: CfnOutput;
    constructor(scope: Construct, id: string, props?: StageProps) {
        super(scope, id, props);
        const app = new AppStack(this, 'ApplicationStack')
        this.appUrlOutput = app.urlOutput
    }
}

export class ProdStage extends Stage {
    public readonly appUrlOutput: CfnOutput;
    constructor(scope: Construct, id: string, props?: StageProps) {
        super(scope, id, props);
        const app = new AppStack(this, 'ApplicationStack')
        this.appUrlOutput = app.urlOutput
        new CanaryStack(this, 'WebSocketCanaryStack', {
            websocketUrl: this.appUrlOutput.value
        });
    }
}