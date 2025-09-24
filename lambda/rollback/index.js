// import { 
//   CodePipelineClient, 
//   ListPipelineExecutionsCommand, 
//   GetPipelineExecutionCommand, 
//   RollbackStageCommand 
// } from "@aws-sdk/client-codepipeline";
// 
const { CodePipelineClient, ListPipelineExecutionsCommand, RollbackStageCommand } = require("@aws-sdk/client-codepipeline");

const client = new CodePipelineClient({ region: process.env.REGION });

exports.handler = async (event) => {
  console.log("Alarm event received:", JSON.stringify(event));

  const pipelineName = process.env.PIPELINE_NAME;
  const stageName = process.env.STAGE_NAME;

  const listCommand = new ListPipelineExecutionsCommand({ 
    pipelineName, 
    maxResults: 10 
  });

  const executions = await client.send(listCommand);

  if (!executions.pipelineExecutionSummaries) {
    console.error("No executions found");
    return;
  }

  const lastSuccessful = executions.pipelineExecutionSummaries.find(
    (e) => e.status === "Succeeded"
  );

  if (!lastSuccessful) {
    console.error("No successful execution found to roll back to");
    return;
  }

  console.log("Rolling back to execution ID:", lastSuccessful.pipelineExecutionId);

  const rollbackCommand = new RollbackStageCommand({
    pipelineName,
    stageName,
    targetPipelineExecutionId: lastSuccessful.pipelineExecutionId
  });

  const response = await client.send(rollbackCommand);
  console.log("Rollback response:", response);
};




// import { CodePipelineClient, ListPipelineExecutionsCommand, GetPipelineExecutionCommand, RollbackStageCommand } from "@aws-sdk/client-codepipeline";

// const client = new CodePipelineClient({ region: process.env.REGION });

// export const handler = async (event: any) => {
//   console.log("Alarm event received:", JSON.stringify(event));

//   const pipelineName = process.env.PIPELINE_NAME!;
//   const stageName = process.env.STAGE_NAME!;

//   const listCommand = new ListPipelineExecutionsCommand({ pipelineName, maxResults: 10 });
//   const executions = await client.send(listCommand);

//   if (!executions.pipelineExecutionSummaries) {
//     console.error("No executions found");
//     return;
//   }


//   const lastSuccessful = executions.pipelineExecutionSummaries.find((e) => e.status === "Succeeded");

//   if (!lastSuccessful) {
//     console.error("No successful execution found to roll back to");
//     return;
//   }

//   console.log("Rolling back to execution ID:", lastSuccessful.pipelineExecutionId);

//   const rollbackCommand = new RollbackStageCommand({
//     pipelineName,
//     stageName,
//     targetPipelineExecutionId: lastSuccessful.pipelineExecutionId!,
//   });

//   const response = await client.send(rollbackCommand);
//   console.log("Rollback response:", response);
// };