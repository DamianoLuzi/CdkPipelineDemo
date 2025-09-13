import { Stage,StageProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CommunityHubStack } from "./application-stack";

export class PipelineStage extends Stage {
    constructor(scope: Construct, id: string, props?: StageProps) {
        super(scope, id, props);
        const app = new CommunityHubStack(this, 'CommunityHubStack')
    }
}