#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { LocalstackStack } from '../lib/localstack-stack';

const app = new cdk.App();

new LocalstackStack(app, 'test1');
