import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ASGRunnerStack } from '../lib/asg-runner-stack';
import { ENVIRONMENT_STAGE } from '../lib/finch-pipeline-app-stage';
import { PlatformType, RunnerConfig, RunnerType } from '../config/runner-config';

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
      template.hasResourceProperties('AWS::EC2::LaunchTemplate', {
        LaunchTemplateData: {
          InstanceType:
            type.platform === PlatformType.WINDOWS ? 'm5zn.metal' : type.arch === 'arm' ? 'mac2.metal' : 'mac1.metal'
        }
      });
    });
  });
});
