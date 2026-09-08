import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
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
          instanceType = 'c7i.2xlarge';
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

  it('gives dedicated-host runners N+1 capacity and launch-before-terminate', () => {
    // macOS/Windows runners run on scarce dedicated-host (metal) capacity. To avoid a
    // rolling update terminating an instance before its replacement can be placed, they
    // get maxCapacity = desired + 1 and keep desired instances in service during rollout.
    runnerConfig.runnerTypes
      .filter((type) => type.platform === PlatformType.MAC || type.platform === PlatformType.WINDOWS)
      .forEach((type) => {
        const stack = stacks.find((s) => s.stackName === generateASGStackName(type));
        const template = Template.fromStack(stack!);
        template.hasResourceProperties('AWS::AutoScaling::AutoScalingGroup', {
          MinSize: '0',
          MaxSize: `${type.desiredInstances + 1}`,
          DesiredCapacity: `${type.desiredInstances}`
        });
        // Rolling update keeps desired instances in service (launch-before-terminate).
        template.hasResource('AWS::AutoScaling::AutoScalingGroup', {
          UpdatePolicy: {
            AutoScalingRollingUpdate: {
              MinInstancesInService: type.desiredInstances,
              MaxBatchSize: 1
            }
          }
        });
        // Dedicated hosts are retained (not auto-released) so the reserved slot persists.
        template.hasResourceProperties('AWS::ResourceGroups::Group', {
          Configuration: Match.arrayWith([
            Match.objectLike({
              Type: 'AWS::EC2::HostManagement',
              Parameters: Match.arrayWith([
                Match.objectLike({ Name: 'auto-release-host', Values: ['false'] })
              ])
            })
          ])
        });
      });
  });

  it('non-dedicated-host runners keep maxCapacity equal to desired', () => {
    runnerConfig.runnerTypes
      .filter((type) => type.platform === PlatformType.AMAZONLINUX)
      .forEach((type) => {
        const stack = stacks.find((s) => s.stackName === generateASGStackName(type));
        const template = Template.fromStack(stack!);
        template.hasResourceProperties('AWS::AutoScaling::AutoScalingGroup', {
          MaxSize: `${type.desiredInstances}`,
          DesiredCapacity: `${type.desiredInstances}`
        });
      });
  });
});
