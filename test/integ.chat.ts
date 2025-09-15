import { App, Stack } from 'aws-cdk-lib';
import { CdkChatConstruct } from '../lib/chat-construct';
import { CdkAnalyticsConstruct } from '../lib/analytics-construct'; 
import { IntegTest, ExpectedResult, InvocationType } from '@aws-cdk/integ-tests-alpha';

const app = new App(); 
const stack = new Stack(app, 'ChatStack'); 

const analytics = new CdkAnalyticsConstruct(stack, 'AnalyticsConstruct'); 
const chat = new CdkChatConstruct(stack, 'ChatConstruct', /*{ eventBus: analytics.eventBus, }*/); 

const integ = new IntegTest(app, 'ChatIntegTest', { testCases: [stack], }); 


integ.assertions.invokeFunction({
    functionName: chat.connectLambda.functionName,
    payload: JSON.stringify({
        requestContext: {
            connectionId: 'test-conn-1',
            routeKey: '$connect',
        },
    }),
})
.next(integ.assertions.awsApiCall('DynamoDB', 'getItem', {
    TableName: chat.table.tableName,
    Key: {
        connectionId: { S: 'test-conn-1' },
    },
}))
.expect(ExpectedResult.objectLike({
    Item: { connectionId: { S: 'test-conn-1' } },
}))
.waitForAssertions();

integ.assertions.invokeFunction({
    functionName: chat.disconnectLambda.functionName,
    payload: JSON.stringify({
        requestContext: {
            connectionId: 'test-conn-1',
            routeKey: '$disconnect',
        },
    }),
})
.next(integ.assertions.awsApiCall('DynamoDB', 'getItem', {
    TableName: chat.table.tableName,
    Key: {
        connectionId: { S: 'test-conn-1' },
    },
}))
.expect(ExpectedResult.objectLike({
    Item: undefined,
}))
.waitForAssertions();