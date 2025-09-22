import { App, Duration, Stack } from 'aws-cdk-lib';
import { CdkChatConstruct } from '../lib/chat-construct';
import { IntegTest, ExpectedResult, InvocationType } from '@aws-cdk/integ-tests-alpha';

const app = new App();
const stack = new Stack(app, 'TestChatStack');

const chat = new CdkChatConstruct(stack, 'ChatConstruct');

const integ = new IntegTest(app, 'ChatIntegTest', {
    testCases: [stack],
    regions: ['us-east-1'],
    cdkCommandOptions: {
        destroy: {
            args: { force: true }
        }
    }
});

const testRunId = Date.now().toString();
const conn1 = `test-conn-1-${testRunId}`;
const conn2 = `test-conn-2-${testRunId}`;

const connectAssert1 = integ.assertions.invokeFunction({
    functionName: chat.connectLambda.functionName,
    payload: JSON.stringify({
        requestContext: {
            connectionId: conn1,
            routeKey: '$connect',
        },
    }),
});

const verifyGetItem1 = connectAssert1.next(integ.assertions.awsApiCall('DynamoDB', 'getItem', {
    TableName: chat.table.tableName,
    Key: {
        connectionId: { S: conn1 },
    },
    ConsistentRead: true
}))
    .expect(ExpectedResult.objectLike({
        Item: { connectionId: { S: conn1 } },
    }));

const connectAssert2 = verifyGetItem1.next(integ.assertions.invokeFunction({
    functionName: chat.connectLambda.functionName,
    payload: JSON.stringify({
        requestContext: {
            connectionId: conn2,
            routeKey: '$connect',
        },
    }),
}));

const verifyGetItem2 = connectAssert2.next(integ.assertions.awsApiCall('DynamoDB', 'getItem', {
    TableName: chat.table.tableName,
    Key: { connectionId: { S: conn2 } },
    ConsistentRead: true
}))
.expect(ExpectedResult.objectLike({
    Item: { connectionId: { S: conn2 } }
}));

const sendMessageAssert = verifyGetItem2.next(integ.assertions.invokeFunction({
    functionName: chat.sendMessageLambda.functionName,
    payload: JSON.stringify({
        body: JSON.stringify({ action: "sendmessage", message: "Hello, world!" }),
        requestContext: {
            connectionId: conn1,
            routeKey: 'sendmessage',
            apiId: chat.chatApi.apiId,
            stage: chat.stage.stageName,
            domainName: `${chat.chatApi.apiId}.execute-api.${stack.region}.amazonaws.com`,
        },
    }),
    invocationType: InvocationType.REQUEST_RESPONSE,
}))
.expect(ExpectedResult.objectLike({
    StatusCode: 200,
}));

const invalidMessageAssert = integ.assertions.invokeFunction({
    functionName: chat.sendMessageLambda.functionName,
    payload: JSON.stringify({
        requestContext: {
            connectionId: conn1,
            routeKey: 'sendmessage',
        },
    }),
    invocationType: InvocationType.REQUEST_RESPONSE,
})
.expect(ExpectedResult.objectLike({
    StatusCode: 400,
}));

const disconnectAssert1 = sendMessageAssert.next(integ.assertions.invokeFunction({
    functionName: chat.disconnectLambda.functionName,
    payload: JSON.stringify({
        requestContext: {
            connectionId: conn1,
            routeKey: '$disconnect',
        },
    }),
}));

const verifyDisconnect1 = disconnectAssert1.next(integ.assertions.awsApiCall('DynamoDB', 'getItem', {
    TableName: chat.table.tableName,
    Key: {
        connectionId: { S: conn1 },
    },
    ConsistentRead: true
}))
.expect(ExpectedResult.objectLike({
    Item: undefined,
}));

const disconnectAssert2 = verifyDisconnect1.next(integ.assertions.invokeFunction({
    functionName: chat.disconnectLambda.functionName,
    payload: JSON.stringify({
        requestContext: {
            connectionId: conn2,
            routeKey: '$disconnect',
        },
    }),
}));

disconnectAssert2.next(integ.assertions.awsApiCall('DynamoDB', 'getItem', {
    TableName: chat.table.tableName,
    Key: {
        connectionId: { S: conn2 },
    },
    ConsistentRead: true
}))
.expect(ExpectedResult.objectLike({
    Item: undefined,
}))
.waitForAssertions({
    totalTimeout: Duration.seconds(90),
    interval: Duration.seconds(5)
});