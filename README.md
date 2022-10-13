# Attention
This project is just an example to reproduce a case of bug or the expected behavior. This code should therefore not be used (in part or in whole) in a real project without being assured of its proper functioning.

# Description
In the functions folder, there is a lambda function authCustomMessage, as its name suggests, allows you to customize the message that a user will receive when he registers. This lambda function is deployed and listed as a trigger for cognito in the stack definition in `lib/localstack-stack.ts`

In the `test/register-user.ts` test file, there, is the code that sends the request to cognito in order to register a user. In the provided cognito information, exists the ClientMetadata attribute. This attribute is supposed to be sent with its value, to the authCustomMessage lambda function as we can expect in a concrete case on [AWS](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_SignUp.html#API_SignUp_RequestParameters).

# Problem
When calling the signUp method on cognitoIdentityServiceProvider, the lambda functions/authCustomMessage function is called but the transmitted request data does not contain the expected value for the clientMetada attribute `"clientMetadata":{}`

# How to reproduce

Clone the repository locally. Make sure you have docker installed and running on your machine. You must have a Localstack Pro account and have the api key. In the docker-compose file, put your api key for the LOCALSTACK_API_KEY environment variable.

Do the following:

- Install the project packages by doing `yarn` at the root of the project.
- Build the function with the command: `yarn build`
- Return to the root of the project `cd ../..`
- Start localstack with the command `docker-compose up`.
- Open another terminal in the folder of this project
- Deploy to localstack with the following commands: `npx cdklocal bootstrap` `npx cdklocal deploy`
- When the deployment is finished, you should have some outputs, copy the value of `test1.UserPoolId` and put this value in the url which is on line 9 of the file `test/register-user.ts` so to have `https://localhost:4566/<user_pool_id>` .
- In this same file, on line 21 put the value of the output `test1.UserPoolClientId` as the value for the attribute `ClientId`
- Save the modified files of course 😎
- Run the following command to run the test: `npx ts-node test/register-user.ts`
- To see the lambda function logs, type the command `aws --endpoint-url=http://localhost:4566 logs describe-log-groups` to see the endpoints of the log groups, copy the endpoint that corresponds to the lambda function authCustomMessage. Like this: `/aws/lambda/AuthCustomMessage-test1`
- Type the command: `aws --endpoint-url=http://localhost:4566 logs tail /aws/lambda/AuthCustomMessage-test1 --follow`

You should see in the output ```2022-10-13T09:27:44.403Z bcede661-0af8-1ffa-4455-5907dad653f1 INFO EVENT: {"version":"$LATEST","triggerSource":"CustomMessage_SignUp", "region":"us-east-1","userPoolId":"us-east-1_dc5adb2b56864b20860f55eb5fb966c7","callerContext":{"awsSdkVersion":"TODO","clientId":"CLIENT_ID_NOT_APPLICABLE"},"request": {"userAttributes":{},"validationData":{},"clientMetadata":{},"session":[],"codeParameter":"234012","usernameParameter":"testuser16@test.com"}, "response":{},"userName":"testuser16@test.com"}```

Notice the clientMetadata value is empty.
