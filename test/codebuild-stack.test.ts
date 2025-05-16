import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { CodeBuildStack } from '../lib/codebuild-stack';

import { BuildImageOS, CODEBUILD_STACKS, CodeBuildStackArgs, toStackName } from '../lib/utils';

describe('CodeBuildStack', () => {
  test('synthesizes the way we expect', () => {
    const app = new cdk.App();
    const codebuildStackArgs: CodeBuildStackArgs = {
      operatingSystem: 'ubuntu',
      arch: 'x86_64',
      amiSearchString: 'ubuntu*22.04*',
      environmentType: codebuild.EnvironmentType.LINUX_EC2,
      buildImageOS: BuildImageOS.LINUX
    };

    const stack = new CodeBuildStack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'us-east-1'
      },
      projectName: 'test-project',
      region: 'us-west-2',
      ...codebuildStackArgs
    });
    const template = Template.fromStack(stack);

    validateTemplate(codebuildStackArgs, template);
  });

  test('all codebuild stacks in ./utils synthesize as expected', () => {
    for (const codebuildStackArgs of CODEBUILD_STACKS) {
      const app = new cdk.App();
      const stack = new CodeBuildStack(app, 'TestStack', {
        env: {
          account: '123456789012',
          region: 'us-east-1'
        },
        projectName: 'test-project',
        region: 'us-west-2',
        ...codebuildStackArgs
      });
      const template = Template.fromStack(stack);

      validateTemplate(codebuildStackArgs, template);
    }
  });
});

const validateTemplate = (codebuildStack: CodeBuildStackArgs, template: Template) => {
  // Assert that the stack creates a Fleet
  template.hasResourceProperties('AWS::CodeBuild::Project', {
    Name: 'test-project',
    Environment: {
      Type: codebuildStack.environmentType,
      ComputeType: 'BUILD_GENERAL1_MEDIUM',
      Image: Match.stringLikeRegexp('ami-1234'),
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
    EnvironmentType: codebuildStack.environmentType
  });

  // Assert that the stack creates a Fleet service role
  template.hasResourceProperties('AWS::IAM::Role', {
    ManagedPolicyArns: Match.arrayWith([
      {
        'Fn::Join': ['', Match.arrayWith([':iam::aws:policy/AmazonEC2FullAccess'])]
      },
      {
        'Fn::Join': ['', Match.arrayWith([':iam::aws:policy/AmazonSSMManagedInstanceCore'])]
      }
    ])
  });

  // Assert that the stack creates a KMS key
  template.hasResourceProperties('AWS::KMS::Key', {
    Description: 'Kms Key to encrypt data-at-rest',
    Enabled: true
  });

  // Assert that the stack creates a KMS alias
  template.hasResourceProperties('AWS::KMS::Alias', {
    AliasName: Match.stringLikeRegexp(
      `alias/finch-${codebuildStack.operatingSystem}-${toStackName(codebuildStack.arch)}-kms-us-west-2`
    )
  });

  // Check resource count
  template.resourceCountIs('AWS::CodeBuild::Project', 1);
  template.resourceCountIs('AWS::CodeBuild::Fleet', 1);
  template.resourceCountIs('AWS::KMS::Key', 1);
};
