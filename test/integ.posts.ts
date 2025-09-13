import { App, Stack } from 'aws-cdk-lib';
import { IntegTest, ExpectedResult } from '@aws-cdk/integ-tests-alpha';
import { CdkAnalyticsConstruct } from '../lib/analytics-construct';
import { CdkPostsConstruct } from '../lib/posts-contruct';
import * as assertions from '@aws-cdk/assertions';

const app = new App();
const stack = new Stack(app, 'PostsStack');

const analytics = new CdkAnalyticsConstruct(stack, 'AnalyticsConstruct');
const posts = new CdkPostsConstruct(stack, 'PostsConstruct', {
    eventBus: analytics.eventBus,
});

const integ = new IntegTest(app, 'PostsIntegTest', {
    testCases: [stack],
});

const testPostContent = 'This is a test post that is intentionally long to meet the 300-character validation rule set in the Lambda function. The purpose of this test is to ensure that the post content is properly analyzed for toxicity and then stored in the DynamoDB table as expected. The content must be long enough to be considered a "review" by the Lambda function, so we will fill it with enough text to surpass the minimum length requirement. This ensures our test is accurate and robust. The content must be long enough to be considered a "review" by the Lambda function, so we will fill it with enough text to surpass the minimum length requirement. This ensures our test is accurate and robust.';

const resp = integ.assertions.httpApiCall(posts.postsApi.urlForPath('/posts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        content: testPostContent,
        author: 'TestUser',
    }),
})

resp.assertAtPath('body',ExpectedResult.objectLike({
  message: "Post created successfully",
  postId: assertions.Match.anyValue()
}));

const  getResp = integ.assertions.httpApiCall(posts.postsApi.urlForPath('/posts'), {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
});

getResp.assertAtPath('body',ExpectedResult.arrayWith([
  {
    GSI_PK: 'posts',
    author: assertions.Match.anyValue(),
    content: assertions.Match.anyValue(),
    createdAt: assertions.Match.anyValue(),
    postId: assertions.Match.anyValue(),
    toxicityScore: assertions.Match.anyValue()
  }
]));


