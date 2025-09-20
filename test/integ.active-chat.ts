import { App, Stack, Duration } from 'aws-cdk-lib';
import { CdkChatConstruct } from '../lib/chat-construct';
import { IntegTest, ExpectedResult, InvocationType } from '@aws-cdk/integ-tests-alpha';
import { Match } from 'aws-cdk-lib/assertions';

const app = new App();
const stack = new Stack(app, 'ActiveChatTestStack');

const chat = new CdkChatConstruct(stack, 'ChatConstruct');

const integ = new IntegTest(app, 'ActiveChatIntegTest', {
    testCases: [stack],
    regions: ['us-east-1'],
    cdkCommandOptions: {
        destroy: { args: { force: true } }
    }
});

const testRunId = Date.now().toString();
const conn1 = `test-conn-1-${testRunId}`;
const conn2 = `test-conn-2-${testRunId}`;

console.log(`Testing with connections: ${conn1}, ${conn2}`);

// TEST 1: Basic Connection Management
integ.assertions.invokeFunction({
    functionName: chat.connectLambda.functionName,
    payload: JSON.stringify({
        requestContext: {
            connectionId: conn1,
            routeKey: '$connect',
        },
    }),
    invocationType: InvocationType.REQUEST_RESPONSE,
})
.expect(ExpectedResult.objectLike({
    StatusCode: 200
}));

integ.assertions.awsApiCall('DynamoDB', 'getItem', {
    TableName: chat.table.tableName,
    Key: {
        connectionId: { S: conn1 },
    },
    ConsistentRead: true
})
.expect(ExpectedResult.objectLike({
    Item: { connectionId: { S: conn1 } },
}))
.waitForAssertions({
    totalTimeout: Duration.seconds(30),
    interval: Duration.seconds(3)
});

integ.assertions.invokeFunction({
    functionName: chat.connectLambda.functionName,
    payload: JSON.stringify({
        requestContext: {
            connectionId: conn2,
            routeKey: '$connect',
        },
    }),
})
.expect(ExpectedResult.objectLike({
    StatusCode: 200
}));
integ.assertions.awsApiCall('DynamoDB', 'scan', {
    TableName: chat.table.tableName,
    Select: 'COUNT'
})
.expect(ExpectedResult.objectLike({
    Count: Match.anyValue()
}))
.waitForAssertions({
    totalTimeout: Duration.seconds(20),
    interval: Duration.seconds(2)
});

integ.assertions.invokeFunction({
    functionName: chat.sendMessageLambda.functionName,
    payload: JSON.stringify({
        body: JSON.stringify({
            action: 'sendmessage',
            message: 'Test message for integration'
        }),
        requestContext: {
            connectionId: conn1,
            routeKey: 'sendmessage',
            apiId: chat.chatApi.apiId,
            stage: chat.stage.stageName,
            domainName: `${chat.chatApi.apiId}.execute-api.${stack.region || 'us-east-1'}.amazonaws.com`,
        },
    }),
    invocationType: InvocationType.REQUEST_RESPONSE,
})
.expect(ExpectedResult.objectLike({
    StatusCode: 200
}))
.waitForAssertions({
    totalTimeout: Duration.seconds(30),
    interval: Duration.seconds(3)
});
integ.assertions.invokeFunction({
    functionName: chat.sendMessageLambda.functionName,
    payload: JSON.stringify({
        body: '{"invalid": json}',
        requestContext: {
            connectionId: conn1,
            routeKey: 'sendmessage',
            apiId: chat.chatApi.apiId,
            stage: chat.stage.stageName,
            domainName: `${chat.chatApi.apiId}.execute-api.${stack.region || 'us-east-1'}.amazonaws.com`,
        },
    }),
})
.expect(ExpectedResult.objectLike({
    StatusCode: 400 
}));

integ.assertions.invokeFunction({
    functionName: chat.disconnectLambda.functionName,
    payload: JSON.stringify({
        requestContext: {
            connectionId: conn1,
            routeKey: '$disconnect',
        },
    }),
})
.expect(ExpectedResult.objectLike({
    StatusCode: 200
}));

integ.assertions.awsApiCall('DynamoDB', 'getItem', {
    TableName: chat.table.tableName,
    Key: {
        connectionId: { S: conn1 },
    },
    ConsistentRead: true
})
.waitForAssertions({
    totalTimeout: Duration.seconds(20),
    interval: Duration.seconds(2)
});

integ.assertions.invokeFunction({
    functionName: chat.disconnectLambda.functionName,
    payload: JSON.stringify({
        requestContext: {
            connectionId: conn2,
            routeKey: '$disconnect',
        },
    }),
})
.expect(ExpectedResult.objectLike({
    StatusCode: 200
}));

console.log('Practical integration test configured successfully.');