import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { FinchPipelineStack } from '../lib/finch-pipeline-stack';
import { EnvConfig } from '../config/env-config';

describe('FinchPipelineStack', () => {
  test('synthesizes the way we expect', () => {
    const app = new cdk.App();
    const stack = new FinchPipelineStack(app, 'TestPipelineStack', {
      env: EnvConfig.envPipeline
    });
    const template = Template.fromStack(stack);

    // assert that the pipeline has a s3 bucket used to store artifacts, e.g. source code of the infrastructure repo
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.hasResource('AWS::S3::Bucket', {
      Properties: {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'aws:kms'
              }
            }
          ]
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true
        }
      },
      UpdateReplacePolicy: 'Retain',
      DeletionPolicy: 'Retain'
    });

    // assert the pipeline role
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'codepipeline.amazonaws.com'
            }
          }
        ],
        Version: '2012-10-17'
      }
    });

    // assert the FinchPipelineStack creates a CodePipeline resource
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      RoleArn: {
        'Fn::GetAtt': ['FinchPipelineRole198D7E07', 'Arn']
      }
    });
  });
});
