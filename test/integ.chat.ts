import { App, Stack } from 'aws-cdk-lib';
import { CdkChatConstruct } from '../lib/chat-construct';
import { IntegTest, ExpectedResult, InvocationType } from '@aws-cdk/integ-tests-alpha';

const app = new App(); 
const stack = new Stack(app, 'TestChatStack'); 

const chat = new CdkChatConstruct(stack, 'ChatConstruct'); 

const integ = new IntegTest(app, 'ChatIntegTest',
     { testCases: [stack],
        regions: [ 'us-east-1'],
        cdkCommandOptions: {
        destroy: { 
            args: { force: true } 
        }
    }
    },
); 


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

integ.assertions.invokeFunction({
    functionName: chat.connectLambda.functionName,
    payload: JSON.stringify({
        requestContext: {
            connectionId: 'test-conn-2',
            routeKey: '$connect',
        },
    }),
}).next(integ.assertions.awsApiCall('DynamoDB', 'getItem', {
    TableName: chat.table.tableName,
    Key: { connectionId: { S: 'test-conn-2' } },
})).expect(ExpectedResult.objectLike({ Item: { connectionId: { S: 'test-conn-2' } } })).waitForAssertions();

integ.assertions.invokeFunction({
    functionName: chat.sendMessageLambda.functionName,
    payload: JSON.stringify({
        body: JSON.stringify({ message: "Hello, world!" }),
        requestContext: {
            connectionId: 'test-conn-1',
            routeKey: 'sendmessage',
        },
    }),
    invocationType: InvocationType.REQUEST_RESPONSE,
})
.expect(ExpectedResult.objectLike({
    statusCode: 200,
}))
.waitForAssertions();


// import { App, Duration, Stack } from 'aws-cdk-lib';
// import { CdkChatConstruct } from '../lib/chat-construct';
// import { IntegTest, ExpectedResult, InvocationType } from '@aws-cdk/integ-tests-alpha';

// const app = new App();
// const stack = new Stack(app, 'IntegTestChatStack');
// const chat = new CdkChatConstruct(stack, 'ChatConstruct');

// const integ = new IntegTest(app, 'ChatIntegTest', {
//     testCases: [stack],
//     cdkCommandOptions: {
//         destroy: {
//             args: {
//                 force: true,
//             },
//         },
//     },
//     regions: [stack.region || 'us-east-1'],
//     diffAssets: true,
//     stackUpdateWorkflow: true,
// });

// // Generate unique connection IDs to avoid conflicts
// const testRunId = Date.now().toString();
// const connectionId1 = `test-conn-1-${testRunId}`;
// const connectionId2 = `test-conn-2-${testRunId}`;

// console.log(`Starting integration test with connections: ${connectionId1}, ${connectionId2}`);

// // Test 1: Basic Connection Test
// console.log('Test 1: Testing connection lambda...');
// integ.assertions.invokeFunction({
//     functionName: chat.connectLambda.functionName,
//     payload: JSON.stringify({
//         requestContext: {
//             connectionId: connectionId1,
//             routeKey: '$connect',
//             apiId: 'test-api-id',
//             stage: 'production',
//             requestId: 'test-request-id'
//         },
//         headers: {
//             'User-Agent': 'test-client',
//             'Host': 'test.execute-api.us-east-1.amazonaws.com'
//         },
//         isBase64Encoded: false
//     }),
//     invocationType: InvocationType.REQUEST_RESPONSE
// })
// .expect(ExpectedResult.objectLike({
//     StatusCode: 200
// }));

// // Test 2: Verify Connection Storage
// console.log('Test 2: Verifying connection was stored...');
// integ.assertions.awsApiCall('DynamoDB', 'getItem', {
//     TableName: chat.table.tableName,
//     Key: {
//         connectionId: { S: connectionId1 }
//     },
//     ConsistentRead: true
// })
// .expect(ExpectedResult.objectLike({
//     Item: {
//         connectionId: { S: connectionId1 }
//     }
// }))
// .waitForAssertions({
//     totalTimeout: Duration.seconds(30),
//     interval: Duration.seconds(2)
// });

// // Test 3: Second Connection
// console.log('Test 3: Testing second connection...');
// integ.assertions.invokeFunction({
//     functionName: chat.connectLambda.functionName,
//     payload: JSON.stringify({
//         requestContext: {
//             connectionId: connectionId2,
//             routeKey: '$connect',
//             apiId: 'test-api-id',
//             stage: 'production',
//             requestId: 'test-request-id-2'
//         }
//     }),
// })
// .expect(ExpectedResult.objectLike({
//     StatusCode: 200
// }));

// // Test 4: Verify Multiple Connections
// console.log('Test 4: Verifying multiple connections...');
// integ.assertions.awsApiCall('DynamoDB', 'scan', {
//     TableName: chat.table.tableName,
//     FilterExpression: 'begins_with(connectionId, :prefix)',
//     ExpressionAttributeValues: {
//         ':prefix': { S: `test-conn-${testRunId.slice(-6)}` }
//     }
// })
// .expect(ExpectedResult.objectLike({
//     Count: 2
//     // Note: Items structure can vary, so just check the count
// }))
// .waitForAssertions({
//     totalTimeout: Duration.seconds(30),
//     interval: Duration.seconds(2)
// });

// // Test 5: Send Message Test
// console.log('Test 5: Testing send message...');
// integ.assertions.invokeFunction({
//     functionName: chat.sendMessageLambda.functionName,
//     payload: JSON.stringify({
//         requestContext: {
//             connectionId: connectionId1,
//             routeKey: 'sendmessage',
//             apiId: 'test-api-id',
//             stage: 'production'
//         },
//         body: JSON.stringify({
//             action: 'sendmessage',
//             message: 'Hello from integration test!',
//             timestamp: Date.now()
//         })
//     }),
// })
// .expect(ExpectedResult.objectLike({
//     StatusCode: 200
// }));

// // Test 6: Error Handling - Send to Non-existent Connection
// console.log('Test 6: Testing error handling...');
// integ.assertions.invokeFunction({
//     functionName: chat.sendMessageLambda.functionName,
//     payload: JSON.stringify({
//         requestContext: {
//             connectionId: 'non-existent-connection-id',
//             routeKey: 'sendmessage',
//         },
//         body: JSON.stringify({
//             action: 'sendmessage',
//             message: 'This should fail'
//         })
//     }),
// })
// .expect(ExpectedResult.objectLike({
//     // Just check that we get some response - the exact status depends on your lambda implementation
//     StatusCode: 200 
// }));

// // Test 7: Disconnect First Connection
// console.log('Test 7: Testing disconnect...');
// integ.assertions.invokeFunction({
//     functionName: chat.disconnectLambda.functionName,
//     payload: JSON.stringify({
//         requestContext: {
//             connectionId: connectionId1,
//             routeKey: '$disconnect',
//         },
//     }),
// })
// .expect(ExpectedResult.objectLike({
//     StatusCode: 200
// }));

// // Test 8: Verify Disconnection - Check that item is no longer there
// console.log('Test 8: Verifying disconnection...');
// integ.assertions.awsApiCall('DynamoDB', 'getItem', {
//     TableName: chat.table.tableName,
//     Key: {
//         connectionId: { S: connectionId1 }
//     }
// })
// .expect(ExpectedResult.objectLike({
//     // When item doesn't exist, DynamoDB returns empty response (no Item key)
//     // So we just check that we get a response without expecting specific content
// }))
// .waitForAssertions({
//     totalTimeout: Duration.seconds(20),
//     interval: Duration.seconds(2)
// });

// // Alternative way to verify disconnection - scan and check count
// integ.assertions.awsApiCall('DynamoDB', 'scan', {
//     TableName: chat.table.tableName,
//     FilterExpression: 'connectionId = :connId',
//     ExpressionAttributeValues: {
//         ':connId': { S: connectionId1 }
//     }
// })
// .expect(ExpectedResult.objectLike({
//     Count: 0,
//     Items: []
// }));

// // Test 9: API Gateway Endpoint Test (Simplified)
// console.log('Test 9: Testing API Gateway endpoint...');
// integ.assertions.httpApiCall(
//     `https://${chat.chatApi.apiId}.execute-api.${stack.region}.amazonaws.com/${chat.stage.stageName}`,
//     {
//         method: 'GET',
//         headers: {
//             'User-Agent': 'integration-test'
//         }
//     }
// )
// .expect(ExpectedResult.objectLike({
//     // WebSocket endpoints typically return 426 (Upgrade Required) for HTTP GET
//     status: 426 
// }));

// // Final Cleanup: Disconnect Remaining Connection
// console.log('Final cleanup: Disconnecting remaining connection...');
// integ.assertions.invokeFunction({
//     functionName: chat.disconnectLambda.functionName,
//     payload: JSON.stringify({
//         requestContext: {
//             connectionId: connectionId2,
//             routeKey: '$disconnect',
//         },
//     }),
// })
// .expect(ExpectedResult.objectLike({
//     StatusCode: 200
// }));

// // Final Verification: Check that test connections are cleaned up
// console.log('Final verification: Checking cleanup...');
// integ.assertions.awsApiCall('DynamoDB', 'scan', {
//     TableName: chat.table.tableName,
//     FilterExpression: 'begins_with(connectionId, :prefix)',
//     ExpressionAttributeValues: {
//         ':prefix': { S: `test-conn-${testRunId.slice(-6)}` }
//     }
// })
// .expect(ExpectedResult.objectLike({
//     Count: 0,
//     Items: []
// }))
// .waitForAssertions({
//     totalTimeout: Duration.seconds(20),
//     interval: Duration.seconds(2)
// });

// console.log('Integration test setup complete.');
// export { integ };