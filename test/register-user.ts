import * as AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'test',
  secretAccessKey: 'test',
  region: 'us-east-1',
  logger: console,
  cognitoidentityserviceprovider: {
    endpoint: `http://localhost:4566/`, // Copy the test1.UserPoolId output from cdk deploy result in terminal
  },
});

(async () => {
  const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider(
    {
      region: 'eu-east-1',
    }
  );

  const params: AWS.CognitoIdentityServiceProvider.SignUpRequest = {
    ClientId: '',
    Password: 'test12345!?',
    Username: 'testuser16@test.com',
    ClientMetadata: {
      profile: JSON.stringify({
        type: 'PRIVATE',
      }),
      signUpOnParentSite: 'false',
      currentSiteId: '80603281-9a0b-4e96-bb88-40ce36cd3ec2',
      parentSiteId: '80603281-9a0b-4e96-bb88-40ce36cd3ec2',
      locale: 'en-US',
    },
    UserAttributes: [
      {
        Name: 'phone_number',
        Value: '+000000000000',
      },
    ],
  };

  const result = await cognitoIdentityServiceProvider.signUp(params).promise();
  console.log('result', result);
})();
