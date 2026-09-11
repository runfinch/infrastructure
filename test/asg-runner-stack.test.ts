import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { PlatformType, RunnerConfig, RunnerType } from '../config/runner-config';
import { ASGRunnerStack } from '../lib/asg-runner-stack';
import { ENVIRONMENT_STAGE } from '../lib/finch-pipeline-app-stage';

const generateASGStackName = (runnerType: RunnerType) =>
  `ASG-${runnerType.platform}-${runnerType.repo}-${runnerType.version.split('.')[0]}-${runnerType.arch}Stack`;

describe('ASGRunnerStack test', () => {
  const app = new cdk.App();
  const runnerConfig = RunnerConfig.runnerProd;
  const stacks: ASGRunnerStack[] = [];
  runnerConfig.runnerTypes.forEach((runnerType) => {
    const ASGStackName = generateASGStackName(runnerType);
    const licenseArn =
      runnerType.platform === PlatformType.WINDOWS ? runnerConfig.windowsLicenseArn : runnerConfig.macLicenseArn;
    stacks.push(
      new ASGRunnerStack(app, ASGStackName, {
        env: {
          account: '123456789012',
          region: 'us-east-1'
        },
        stage: ENVIRONMENT_STAGE.Prod,
        licenseArn: licenseArn,
        type: runnerType
      })
    );
  });
  const templates = stacks.map((stack) => Template.fromStack(stack));

  it('should have the correct number of resources', () => {
    templates.forEach((template) => {
      template.resourceCountIs('AWS::AutoScaling::AutoScalingGroup', 1);
      template.resourceCountIs('AWS::EC2::LaunchTemplate', 1);
      template.resourceCountIs('AWS::ResourceGroups::Group', 1);
      template.resourceCountIs('AWS::EC2::SecurityGroup', 1);
      template.resourceCountIs('AWS::IAM::Role', 1);
      template.resourceCountIs('AWS::IAM::Policy', 1);
    });
  });

  it('should match the runner configuration', () => {
    expect(stacks.length).toBe(runnerConfig.runnerTypes.length);
    runnerConfig.runnerTypes.forEach((type) => {
      const stack = stacks.find((stack) => stack.stackName === generateASGStackName(type));
      expect(stack).toBeDefined();
      const template = Template.fromStack(stack!);
      let instanceType = '';
      switch (type.platform) {
        case PlatformType.WINDOWS: {
          instanceType = 'm5zn.metal';
          break;
        }
        case PlatformType.MAC: {
          if (type.arch === 'arm') {
            instanceType = 'mac2.metal';
          } else {
            instanceType = 'mac1.metal';
          }
          break;
        }
        case PlatformType.AMAZONLINUX: {
          if (type.arch === 'arm') {
            instanceType = 'c7g.large';
          } else {
            instanceType = 'c7a.large';
          }
          break;
        }
      }
      template.hasResourceProperties('AWS::EC2::LaunchTemplate', {
        LaunchTemplateData: {
          InstanceType: instanceType
        }
      });
    });
  });

  it('must have termination protection enabled', () => {
    stacks.forEach((stack) => {
      expect(stack.terminationProtection).toBeTruthy();
    });
  });
});
