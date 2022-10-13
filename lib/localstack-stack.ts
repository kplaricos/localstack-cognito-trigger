import {
  Duration,
  Stack,
  StackProps,
  aws_ec2 as ec2,
  aws_cognito as cognito,
  aws_iam as iam
} from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { constructIdentityPool, constructUserGroups, constructUserPool } from './cognito';

export class LocalstackStack extends Stack {
  public vpc: ec2.Vpc;
  public lambdaSecurityGroup: ec2.SecurityGroup;
  public identityPool: cognito.CfnIdentityPool;
  public userPool: cognito.UserPool;
  public userPoolClient: cognito.UserPoolClient;
  public userGroupRole: iam.IRole;
  public authenticatedRole: iam.IRole;
  public unauthenticatedRole: iam.IRole;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    constructUserPool(this);
    constructIdentityPool(this);
    constructUserGroups(this);
  }

  getIdentityProviderUrl(): string {
    return `cognito-idp.${cdk.Stack.of(this).region}.amazonaws.com/${
      this.userPool.userPoolId
    }:${this.userPoolClient.userPoolClientId}`;
  }
}
