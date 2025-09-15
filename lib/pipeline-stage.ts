import { Stage,StageProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { AppStack } from "./application-stack";

export class PipelineStage extends Stage {
    constructor(scope: Construct, id: string, props?: StageProps) {
        super(scope, id, props);
        const app = new AppStack(this, 'ApplicationStack')
    }
}