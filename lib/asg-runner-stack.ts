import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as resourcegroups from 'aws-cdk-lib/aws-resourcegroups';
import { aws_autoscaling as autoscaling } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { RunnerType } from '../config/runner-config';
import { readFileSync } from 'fs';
import { ENVIRONMENT_STAGE } from './finch-pipeline-app-stage';
import { UpdatePolicy } from 'aws-cdk-lib/aws-autoscaling';

interface ASGRunnerStackProps extends cdk.StackProps {
  env: cdk.Environment | undefined;
  stage: ENVIRONMENT_STAGE;
  licenseArn: string;
  type: RunnerType;
}

/**
 * A stack to provision an autoscaling group for macOS instances. This requires:
 *  - a self-managed license (manually created as cdk/cfn does not support this)
 *  - a resource group
 *  - a launch template
 *  - an auto scaling group
 */
export class ASGRunnerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ASGRunnerStackProps) {
    super(scope, id, props);
    const arch = props.type.arch === 'arm' ? 'arm64_mac' : 'x86_64_mac';
    const instanceType = props.type.arch === 'arm' ? 'mac2.metal' : 'mac1.metal';

    if (props.env == undefined) {
      throw new Error('Runner environment is undefined!');
    }

    const vpc = cdk.aws_ec2.Vpc.fromLookup(this, 'VPC', { isDefault: true });

    const securityGroup = new ec2.SecurityGroup(this, 'MacEC2SecurityGroup', {
      vpc,
      description: 'Allow only outbound traffic',
      allowAllOutbound: true
    });

    const role = new iam.Role(this, 'MacEC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });

    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
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

    // Create a custom name for this as names for resource groups cannot be repeated
    const resourceGroupName =
      props.type.repo + '-' + 'Mac' + '-' + props.type.macOSVersion.split('.')[0] + '-' + props.type.arch + 'HostGroup';

    const resourceGroup = new resourcegroups.CfnGroup(this, resourceGroupName, {
      name: resourceGroupName,
      description: 'Host resource group for finchs infrastructure',
      configuration: [
        {
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

    const macOSVersion = props.type.macOSVersion;
    const amiSearchString = `amzn-ec2-macos-${macOSVersion}*`;
    const macImage = new ec2.LookupMachineImage({
      name: amiSearchString,
      filters: {
        'virtualization-type': ['hvm'],
        'root-device-type': ['ebs'],
        architecture: [arch],
        'owner-alias': ['amazon']
      }
    });

    const userData =
      `#!/bin/bash
    LABEL_STAGE=${props.stage === ENVIRONMENT_STAGE.Release ? 'release' : 'test'}
    REPO=${props.type.repo}
    REGION=${props.env?.region}
    ` + readFileSync('./scripts/setup-runner.sh', 'utf8');

    const lt = new ec2.LaunchTemplate(this, 'MacASGLaunchTemplate', {
      requireImdsv2: true,
      instanceType: new ec2.InstanceType(instanceType),
      keyName: 'runner-key',
      machineImage: macImage,
      role: role,
      securityGroup: securityGroup,
      userData: ec2.UserData.custom(userData)
    });

    // Escape hatch to cfnLaunchTemplate as the L2 construct lacked some required
    // configurations.
    const cfnLt = lt.node.defaultChild as ec2.CfnLaunchTemplate;
    cfnLt.launchTemplateData = {
      ...cfnLt.launchTemplateData,
      placement: {
        tenancy: 'host',
        hostResourceGroupArn: resourceGroup.attrArn
      },
      licenseSpecifications: [
        {
          licenseConfigurationArn: props.licenseArn
        }
      ],
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

    const asg = new autoscaling.AutoScalingGroup(this, 'MacASG', {
      vpc,
      desiredCapacity: props.type.desiredInstances,
      maxCapacity: props.type.desiredInstances + 2,
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
          autoscaling.ScalingProcess.SCHEDULED_ACTIONS,
        ],
        waitOnResourceSignals: false,
      })
    });

    if (props.stage === ENVIRONMENT_STAGE.Beta) {
      const scheduledAction = new autoscaling.CfnScheduledAction(this, 'SpinDownBetaInstances', {
        autoScalingGroupName: asg.autoScalingGroupName,
        startTime: new Date(new Date().getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
        desiredCapacity: 0
      });
    }
  }
}
