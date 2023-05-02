#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FinchPipelineStack } from '../lib/finch-pipeline-stack';
import { EnvConfig } from '../config/env-config';

const app = new cdk.App();
new FinchPipelineStack(app, 'FinchPipelineStack', { env: EnvConfig.envPipeline });

app.synth();
