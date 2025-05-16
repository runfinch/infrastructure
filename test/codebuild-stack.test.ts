import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { CodeBuildStack } from '../lib/codebuild-stack';
import { BuildImageOS } from '../lib/utils';

describe('CodeBuildStack', () => {
  test('synthesizes the way we expect', () => {
    const app = new cdk.App();
    const stack = new CodeBuildStack(app, 'TestStack', {
        env: {
            account: '123456789012',
            region: 'us-east-1'
        },
        projectName: 'test-project',
        region: 'us-west-2',
        operatingSystem: "ubuntu",
        arch: 'x86_64',
        amiSearchString: 'ubuntu*22.04*',
        environmentType: codebuild.EnvironmentType.LINUX_EC2,
        buildImageOS: BuildImageOS.LINUX,
    });
    const template = Template.fromStack(stack);

    // Assert that the stack creates a CodeBuild project
    template.hasResourceProperties('AWS::CodeBuild::Project', {
      Name: 'test-project',
      Environment: {
        Type: 'LINUX_EC2',
        ComputeType: 'BUILD_GENERAL1_MEDIUM',
        Image: Match.stringLikeRegexp('ami-1234'),
        PrivilegedMode: true
      },
      Source: {
        Type: 'GITHUB',
        Location: 'https://github.com/runfinch/finch.git',
        ReportBuildStatus: true
      }
    });

    // Assert that the stack creates a Fleet
    template.hasResourceProperties('AWS::CodeBuild::Fleet', {
      BaseCapacity: 1,
      ComputeType: 'BUILD_GENERAL1_MEDIUM',
      EnvironmentType: 'LINUX_EC2'
    });

    // Assert that the stack creates a KMS key
    template.hasResourceProperties('AWS::KMS::Key', {
      Description: 'Kms Key to encrypt data-at-rest',
      Enabled: true
    });

    // Assert that the stack creates a KMS alias
    template.hasResourceProperties('AWS::KMS::Alias', {
      AliasName: Match.stringLikeRegexp('alias/finch-ubuntu-x86_64-kms-us-west-2')
    });

    // Check resource count
    template.resourceCountIs('AWS::CodeBuild::Project', 1);
    template.resourceCountIs('AWS::CodeBuild::Fleet', 1);
    template.resourceCountIs('AWS::KMS::Key', 1);
  });
});
