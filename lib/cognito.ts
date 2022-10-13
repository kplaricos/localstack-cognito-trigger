import * as cdk from 'aws-cdk-lib';
import {
  aws_cognito as cognito,
  aws_lambda as lambda,
  aws_iam as iam,
  aws_s3 as s3,
  aws_s3_deployment as s3Deploy,
  CfnOutput,
  RemovalPolicy,
} from 'aws-cdk-lib';
import * as path from 'path';
import { camelCase } from 'lodash';
import { LocalstackStack } from './localstack-stack';

export interface AuthLambdaTrigers {
  authPreSignUp?: lambda.Function;
  authCustomMessage?: lambda.Function;
  authPostConfirmation?: lambda.Function;
}

export function constructCustomMessageConfirmationBucket(
  stack: LocalstackStack
): void {
  // S3 bucket for auth verification

  const bucket = new s3.Bucket(stack, 'CustomMessageConfirmationBucket', {
    bucketName: `authverificationbucket-${cdk.Aws.STACK_NAME}`,
    accessControl: s3.BucketAccessControl.PRIVATE,
    websiteIndexDocument: 'index.html',
    websiteErrorDocument: 'index.html',
    cors: [
      {
        allowedMethods: [s3.HttpMethods.GET],
        allowedOrigins: ['*'],

        // the properties below are optional
        allowedHeaders: ['Authorization', 'Content-Length'],
        maxAge: 3000,
      },
    ],
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  });

  // Deployment stack for auth verification
  const bucketDeployment = new s3Deploy.BucketDeployment(
    stack,
    'auth-asset-deployment-bucket',
    {
      destinationBucket: bucket,
      sources: [
        s3Deploy.Source.asset(
          path.join(__dirname, '../assets/auth-verification')
        ),
      ],
      accessControl: s3.BucketAccessControl.PUBLIC_READ,
    }
  );

  bucketDeployment.node.addDependency(bucket);
}

export function constructAuthTriggers(stack: LocalstackStack): AuthLambdaTrigers {
  // Create CustomMessage lambda trigger
  const authCustomMessage = new lambda.Function(
    stack,
    `AuthCustomMessage`,
    {
      functionName: `AuthCustomMessage-${cdk.Aws.STACK_NAME}`,
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../functions/authCustomMessage/build')
      ),
      environment: {
        ENV: cdk.Aws.STACK_NAME,
        REDIRECTURL: process.env.REDIRECTURL || 'https://site.com',
        EMAILSUBJECT: process.env.EMAILSUBJECT || 'Your verification link',
        EMAILMESSAGE:
          process.env.EMAILMESSAGE ||
          'Please click the link below to verify your email address:',
        RESOURCENAME: 'authCustomMessage',
      },
      timeout: cdk.Duration.seconds(25)
    }
  );
  constructCustomMessageConfirmationBucket(stack);

  return {
    authCustomMessage
  };
}

export function constructUserPool(stack: LocalstackStack): void {
  const authLambdaTrigers = constructAuthTriggers(stack);

  const userPoolName: string = String(`up_${cdk.Aws.STACK_NAME}`);

  // Create userPool
  stack.userPool = new cognito.UserPool(stack, `user_pool`, {
    enableSmsRole: true,
    selfSignUpEnabled: true,
    email: cognito.UserPoolEmail.withCognito(),
    autoVerify: { email: false, phone: false },
    userPoolName,
    signInAliases: { email: true },
    lambdaTriggers: {
      customMessage: authLambdaTrigers.authCustomMessage,
    },
    passwordPolicy: {
      minLength: 8,
      requireLowercase: false,
      requireUppercase: false,
      requireDigits: false,
      requireSymbols: false,
    },
    standardAttributes: {
      email: {
        required: true,
        mutable: true,
      },
      phoneNumber: {
        required: true,
        mutable: true,
      },
    },
    mfa: cognito.Mfa.OPTIONAL,
    mfaSecondFactor: {
      sms: true,
      otp: true,
    },
    removalPolicy: RemovalPolicy.DESTROY,
  });

  // Create user pool client
  stack.userPoolClient = stack.userPool.addClient('app-client', {
    oAuth: {
      flows: {
        authorizationCodeGrant: true,
      },
      scopes: [cognito.OAuthScope.OPENID],
      // callbackUrls: ['https://my-app-domain.com/welcome'],
      // logoutUrls: ['https://my-app-domain.com/signin'],
    },
    generateSecret: false,
  });
  stack.userPoolClient.node.addDependency(stack.userPool);

  new CfnOutput(stack, 'UserPoolId', {
    value: `${stack.userPool.userPoolId}`,
  });

  new CfnOutput(stack, 'UserPoolArn', {
    value: `${stack.userPool.userPoolArn}`,
    description: 'Arn for the user pool',
  });

  new CfnOutput(stack, 'UserPoolName', {
    value: userPoolName,
  });

  new CfnOutput(stack, 'UserPoolClientId', {
    value: stack.userPoolClient.userPoolClientId,
  });
}

/**
 * Configure user groups
 * [User, Admin, SuperAdmin]
 */
export function constructUserGroups(stack: LocalstackStack): void {
  // ## Default User group ##
  stack.userGroupRole = configureGroupRole(stack, 'User');

  const userGroupUser = new cognito.CfnUserPoolGroup(stack, `User`, {
    userPoolId: stack.userPool.userPoolId,
    description: 'Default user  group',
    groupName: `user`,
    precedence: 1,
    roleArn: stack.userGroupRole.roleArn,
  });

  // ## Super Admin group ##
  const superAdminGroupRole = configureGroupRole(stack, 'superAdmin');

  const superAdminGroup = new cognito.CfnUserPoolGroup(stack, 'superAdmin', {
    userPoolId: stack.userPool.userPoolId,
    description: 'Super admin user group',
    groupName: 'superAdmin',
    precedence: 4,
    roleArn: superAdminGroupRole.roleArn,
  });

  new CfnOutput(stack, 'userGroup', {
    value: userGroupUser.groupName as string,
  });
  new CfnOutput(stack, 'superAdminGroup', {
    value: superAdminGroup.groupName as string,
  });
}

export function constructIdentityPool(stack: LocalstackStack): void {
  stack.identityPool = new cognito.CfnIdentityPool(stack, 'identity-pool', {
    identityPoolName: `idp_${cdk.Aws.STACK_NAME}`,
    allowUnauthenticatedIdentities: true,
    cognitoIdentityProviders: [
      {
        clientId: stack.userPoolClient.userPoolClientId,
        providerName: stack.userPool.userPoolProviderName,
      },
    ],
  });
  stack.authenticatedRole = configureDefaultRole(stack, 'Authenticated');
  stack.unauthenticatedRole = configureDefaultRole(stack, 'Unauthenticated');
  new cognito.CfnIdentityPoolRoleAttachment(
    stack,
    'identity-pool-role-attachment',
    {
      identityPoolId: stack.identityPool.ref,
      roles: {
        authenticated: stack.authenticatedRole.roleArn,
        unauthenticated: stack.unauthenticatedRole.roleArn,
      },
      roleMappings: {
        mapping: {
          type: 'Token',
          ambiguousRoleResolution: 'AuthenticatedRole',
          identityProvider: stack.getIdentityProviderUrl(),
        },
      },
    }
  );

  new CfnOutput(stack, 'IdentityPoolId', {
    value: `${stack.identityPool.ref}`,
    description: 'Id for the identity pool',
  });
  new CfnOutput(stack, 'IdentityPoolName', {
    value: `${stack.identityPool.identityPoolName}`,
  });
}

function configureDefaultGrantPrincipal(type: string, identityPoolId: string) {
  return new iam.FederatedPrincipal(
    'cognito-identity.amazonaws.com',
    {
      StringEquals: {
        'cognito-identity.amazonaws.com:aud': identityPoolId,
      },
      'ForAnyValue:StringLike': {
        'cognito-identity.amazonaws.com:amr': type,
      },
    },
    'sts:AssumeRoleWithWebIdentity'
  );
}

/**
 * Configure Default Roles For Identity Pool
 */
function configureDefaultRole(stack: LocalstackStack, type: string): iam.IRole {
  const assumedBy = configureDefaultGrantPrincipal(
    type.toLowerCase(),
    stack.identityPool.ref
  );
  return new iam.Role(stack, `${type}Role`, {
    description: `Default ${type} Role for Identity Pool ${stack.identityPool.identityPoolName}`,
    assumedBy,
  });
}

function configureGroupRole(stack: LocalstackStack, group: string): iam.IRole {
  const assumedBy = configureDefaultGrantPrincipal(
    'authenticated',
    stack.identityPool.ref
  );
  const groupStackName = `${camelCase(group)}GroupRole`;
  return new iam.Role(stack, groupStackName, {
    roleName: `${stack.userPool.userPoolId}-${groupStackName}`,
    assumedBy,
  });
}
