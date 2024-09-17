import * as cdk from 'aws-cdk-lib';
import { aws_autoscaling as autoscaling } from 'aws-cdk-lib';
import { UpdatePolicy } from 'aws-cdk-lib/aws-autoscaling';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as resourcegroups from 'aws-cdk-lib/aws-resourcegroups';
import { Construct } from 'constructs';
import { readFileSync } from 'fs';
import { PlatformType, RunnerType } from '../config/runner-config';
import { applyTerminationProtectionOnStacks } from './aspects/stack-termination-protection';
import { ENVIRONMENT_STAGE } from './finch-pipeline-app-stage';

interface IASGRunnerStack {
  platform: PlatformType;
  version: string;
  arch: string;
  repo: string;
}

interface ASGRunnerStackProps extends cdk.StackProps {
  env: cdk.Environment | undefined;
  stage: ENVIRONMENT_STAGE;
  /** Only required for dedicated hosts.
   * Right now, dedicated hosts should only be used to avoid
   * nested virtualization issues, which is only a problem for
   * non-Linux usecases. */
  licenseArn?: string;
  type: RunnerType;
}

/**
 * A stack to provision an autoscaling group for macOS instances. This requires:
 *  - a self-managed license (manually created as cdk/cfn does not support this)
 *  - a resource group
 *  - a launch template
 *  - an auto scaling group
 */
export class ASGRunnerStack extends cdk.Stack implements IASGRunnerStack {
  platform: PlatformType;
  version: string;
  arch: string;
  repo: string;

  requiresDedicatedHosts = () => this.platform === PlatformType.MAC || this.platform === PlatformType.WINDOWS;

  userData = (props: ASGRunnerStackProps, setupScriptName: string) =>
    `#!/bin/bash
  LABEL_STAGE=${props.stage === ENVIRONMENT_STAGE.Release ? 'release' : 'test'}
  REPO=${this.repo}
  REGION=${props.env?.region}
  ` + readFileSync(`./scripts/${setupScriptName}`, 'utf8');

  constructor(scope: Construct, id: string, props: ASGRunnerStackProps) {
    super(scope, id, props);

    this.platform = props.type.platform;
    this.version = props.type.version;
    this.arch = props.type.arch;
    this.repo = props.type.repo;

    applyTerminationProtectionOnStacks([this]);

    const amiSearchString = `amzn-ec2-macos-${this.version}*`;

    let instanceType: ec2.InstanceType;
    let machineImage: ec2.IMachineImage;
    let userDataString = '';
    let asgName = '';
    let rootDeviceName = '';
    switch (this.platform) {
      case PlatformType.MAC: {
        rootDeviceName = '/dev/sda1';
        if (this.arch === 'arm') {
          instanceType = ec2.InstanceType.of(ec2.InstanceClass.MAC2, ec2.InstanceSize.METAL);
        } else {
          instanceType = ec2.InstanceType.of(ec2.InstanceClass.MAC1, ec2.InstanceSize.METAL);
        }
        const macOSArchLookup = this.arch === 'arm' ? `arm64_${this.platform}` : `x86_64_${this.platform}`;
        machineImage = new ec2.LookupMachineImage({
          name: amiSearchString,
          filters: {
            'virtualization-type': ['hvm'],
            'root-device-type': ['ebs'],
            architecture: [macOSArchLookup],
            'owner-alias': ['amazon']
          }
        });
        asgName = 'MacASG';
        userDataString = this.userData(props, 'setup-runner.sh');
        break;
      }
      case PlatformType.WINDOWS: {
        instanceType = ec2.InstanceType.of(ec2.InstanceClass.M5ZN, ec2.InstanceSize.METAL);
        asgName = 'WindowsASG';
        rootDeviceName = '/dev/sda1';
        machineImage = ec2.MachineImage.latestWindows(ec2.WindowsVersion.WINDOWS_SERVER_2022_ENGLISH_FULL_BASE);
        // We need to provide user data as a yaml file to specify runAs: admin
        // Maintain that file as yaml and source here to ensure formatting.
        userDataString = readFileSync('./scripts/windows-runner-user-data.yaml', 'utf8')
          .replace('<STAGE>', props.stage === ENVIRONMENT_STAGE.Release ? 'release' : 'test')
          .replace('<REPO>', props.type.repo)
          .replace('<REGION>', props.env?.region || '');

        break;
      }
      case PlatformType.AMAZONLINUX: {
        // Linux instances do not have to be metal, since the only mode of operation
        // for Finch on linux currently is "native" mode, e.g. no virutal machine on host

        rootDeviceName = '/dev/xvda';
        let cpuType: ec2.AmazonLinuxCpuType;
        if (this.arch === 'arm') {
          instanceType = ec2.InstanceType.of(ec2.InstanceClass.C7G, ec2.InstanceSize.LARGE);
          cpuType = ec2.AmazonLinuxCpuType.ARM_64;
        } else {
          instanceType = ec2.InstanceType.of(ec2.InstanceClass.C7A, ec2.InstanceSize.LARGE);
          cpuType = ec2.AmazonLinuxCpuType.X86_64;
        }
        asgName = 'LinuxASG';
        userDataString = this.userData(props, 'setup-linux-runner.sh');
        if (this.version === '2') {
          machineImage = ec2.MachineImage.latestAmazonLinux2({
            cpuType
          });
        } else {
          machineImage = ec2.MachineImage.latestAmazonLinux2023({
            cpuType
          });
        }
        break;
      }
    }

    if (props.env == undefined) {
      throw new Error('Runner environment is undefined!');
    }

    const vpc = cdk.aws_ec2.Vpc.fromLookup(this, 'VPC', { isDefault: true });

    const securityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
      vpc,
      description: 'Allow only outbound traffic',
      allowAllOutbound: true
    });

    const role = new iam.Role(this, 'EC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });

    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AutoScalingFullAccess'));
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('ResourceGroupsandTagEditorFullAccess'));

    // Grant EC2 instances access to secretsmanager to retrieve the GitHub api key to register runners
    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'secretsmanager:GetResourcePolicy',
          'secretsmanager:GetSecretValue',
          'secretsmanager:DescribeSecret',
          'secretsmanager:ListSecretVersionIds'
        ],
        resources: [
          `arn:aws:secretsmanager:${props.env?.region}:${props.env?.account}:secret:${props.type.repo}-runner-reg-key*`
        ]
      })
    );

    // Create a 100GiB volume to be used as instance root volume
    const rootVolume: ec2.BlockDevice = {
      deviceName: rootDeviceName,
      volume: ec2.BlockDeviceVolume.ebs(100, {
        volumeType: ec2.EbsDeviceVolumeType.GP3,
        // throughput / 256 KiB per operation
        // default is size * 3
        iops: 1200,
        throughput: 300
      })
    };

    const ltName = `${asgName}LaunchTemplate`;
    const keyPairName = `${asgName}KeyPair`;
    const lt = new ec2.LaunchTemplate(this, ltName, {
      requireImdsv2: true,
      instanceType,
      keyPair: ec2.KeyPair.fromKeyPairName(this, keyPairName, 'runner-key'),
      machineImage,
      role: role,
      securityGroup: securityGroup,
      userData: ec2.UserData.custom(userDataString),
      blockDevices: [rootVolume]
    });

    // Create a custom name for this as names for resource groups cannot be repeated
    const resourceGroupName = `${this.repo}-${this.platform}-${this.version.split('.')[0]}-${this.arch}HostGroup`;
    const resourceGroupDescription = 'Host resource group for finchs infrastructure';

    let ltPlacementConfig = {};
    if (this.requiresDedicatedHosts()) {
      const hostResourceGroup = this.createHostResourceGroup(resourceGroupName, resourceGroupDescription);
      ltPlacementConfig = {
        placement: {
          tenancy: 'host',
          hostResourceGroupArn: hostResourceGroup.attrArn
        }
      };
    }

    // Escape hatch to cfnLaunchTemplate as the L2 construct lacked some required
    // configurations.
    const cfnLt = lt.node.defaultChild as ec2.CfnLaunchTemplate;
    cfnLt.launchTemplateData = {
      ...cfnLt.launchTemplateData,
      ...(this.requiresDedicatedHosts() && {
        ...ltPlacementConfig,
        licenseSpecifications: [{ licenseConfigurationArn: props.licenseArn }]
      }),
      tagSpecifications: [
        {
          resourceType: 'instance',
          tags: [
            {
              key: 'PVRE-Reporting',
              value: 'SSM'
            }
          ]
        }
      ]
    };

    const asg = new autoscaling.AutoScalingGroup(this, asgName, {
      vpc,
      desiredCapacity: props.type.desiredInstances,
      maxCapacity: props.type.desiredInstances,
      minCapacity: 0,
      healthCheck: autoscaling.HealthCheck.ec2({
        grace: cdk.Duration.seconds(3600)
      }),
      launchTemplate: lt,
      updatePolicy: UpdatePolicy.rollingUpdate({
        // Defaults shown here explicitly except for pauseTime
        // and minSuccesPercentage
        maxBatchSize: 1,
        minInstancesInService: 0,
        suspendProcesses: [
          autoscaling.ScalingProcess.HEALTH_CHECK,
          autoscaling.ScalingProcess.REPLACE_UNHEALTHY,
          autoscaling.ScalingProcess.AZ_REBALANCE,
          autoscaling.ScalingProcess.ALARM_NOTIFICATION,
          autoscaling.ScalingProcess.SCHEDULED_ACTIONS
        ],
        waitOnResourceSignals: false
      })
    });

    if (!this.requiresDedicatedHosts()) {
      this.createTagBasedResourceGroup(resourceGroupName, resourceGroupDescription, asg.autoScalingGroupName);
    }

    if (props.stage === ENVIRONMENT_STAGE.Beta) {
      new autoscaling.CfnScheduledAction(this, 'SpinDownBetaInstances', {
        autoScalingGroupName: asg.autoScalingGroupName,
        // 1 day from now
        startTime: new Date(new Date().getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        desiredCapacity: 0
      });
    }
  }

  // a host resource group is used by the launch template for placement of instances on dedicated hosts
  createHostResourceGroup(resourceGroupName: string, resourceGroupDescription: string) {
    return new resourcegroups.CfnGroup(this, resourceGroupName, {
      name: resourceGroupName,
      description: resourceGroupDescription,
      configuration: [
        {
          // This resource group is only used for management of dedicated hosts, as indicated by
          // the "AWS::EC2::HostManagement" type
          type: 'AWS::EC2::HostManagement',
          parameters: [
            {
              name: 'auto-allocate-host',
              values: ['true']
            },
            {
              name: 'auto-release-host',
              values: ['true']
            },
            {
              name: 'any-host-based-license-configuration',
              values: ['true']
            }
          ]
        },
        {
          type: 'AWS::ResourceGroups::Generic',
          parameters: [
            {
              name: 'allowed-resource-types',
              values: ['AWS::EC2::Host']
            },
            {
              name: 'deletion-protection',
              values: ['UNLESS_EMPTY']
            }
          ]
        }
      ]
    });
  }

  // tag based resource groups filter EC2 instances by tag, anything matching will be included in the group
  createTagBasedResourceGroup(resourceGroupName: string, resourceGroupDescription: string, asgName: string) {
    return new resourcegroups.CfnGroup(this, resourceGroupName, {
      name: resourceGroupName,
      description: resourceGroupDescription,
      resourceQuery: {
        type: 'TAG_FILTERS_1_0',
        query: {
          resourceTypeFilters: ['AWS::EC2::Instance'],
          tagFilters: [
            {
              key: 'aws:autoscaling:groupName',
              values: [asgName]
            }
          ]
        }
      }
    });
  }
}
