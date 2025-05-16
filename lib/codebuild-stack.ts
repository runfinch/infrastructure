import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import {
  BuildImageOS,
  GITHUB_ALLOWLISTED_ACCOUNT_IDS,
  LinuxAMIBuildImage,
  MacAMIBuildImage,
  toStackName,
  WindowsAMIBuildImage
} from './utils';

const webhookFiltersArr: codebuild.FilterGroup[] = [];

for (const userId of GITHUB_ALLOWLISTED_ACCOUNT_IDS) {
  console.log('creating filter group for userid: ', userId);
  webhookFiltersArr.push(
    codebuild.FilterGroup.inEventOf(codebuild.EventAction.WORKFLOW_JOB_QUEUED).andActorAccountIs(userId)
  );
}

const githHubSource = codebuild.Source.gitHub({
  owner: 'runfinch',
  repo: 'finch',
  webhook: true,
  webhookFilters: webhookFiltersArr,
  fetchSubmodules: true,
  cloneDepth: 0,
});

interface ImageFilterProps {
  'virtualization-type': string[];
  'root-device-type': string[];
  'owner-alias': string[];
}

/**
 * Default properties for CodeBuildStack configuration.
 * Contains static readonly properties that define default values for image filters,
 * fleet configuration, and project environment settings.
 */
class CodeBuildStackDefaultProps {
  static readonly imageFilterProps: ImageFilterProps = {
    'virtualization-type': ['hvm'],
    'root-device-type': ['ebs'],
    'owner-alias': ['amazon']
  };
  static readonly fleetProps = {
    computeType: codebuild.FleetComputeType.MEDIUM,
    baseCapacity: 1
  };
  static readonly projectEnvironmentProps = {
    computeType: codebuild.ComputeType.MEDIUM
  };
}

class CodeBuildStackProps {
  env: cdk.Environment | undefined;
  projectName: string;
  region: string;
  arch: string;
  operatingSystem: string;
  amiSearchString: string;
  environmentType: codebuild.EnvironmentType;
  buildImageOS: BuildImageOS;
  imageFilterProps?: ImageFilterProps;
  fleetProps?: {
    computeType: codebuild.FleetComputeType;
    baseCapacity: number;
  };
  projectEnvironmentProps?: {
    computeType: codebuild.ComputeType;
  };
}

export class CodeBuildStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CodeBuildStackProps) {
    super(scope, id, props);
    this.createBuildProject(props, id);
  }

  private createBuildProject(props: CodeBuildStackProps, id: string): codebuild.Project {
    const platformId: string = `${props.operatingSystem}-${toStackName(props.arch)}`;

    const secretArn = this.formatArn({
      service: 'secretsmanager',
      resource: 'secret',
      resourceName: `codebuild-github-access-token-??????`,
      arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME
    });

    new codebuild.GitHubSourceCredentials(this, `code-build-${platformId}-credentials`, {
      accessToken: cdk.SecretValue.secretsManager('codebuild-github-access-token')
    });

    const machineImageProps = {
      name: props.amiSearchString,
      filters: {
        ...(props.imageFilterProps || CodeBuildStackDefaultProps.imageFilterProps),
        architecture: [props.arch]
      }
    };
    const machineImage = new ec2.LookupMachineImage(machineImageProps);

    const fleetServiceRole = new iam.Role(this, `FleetServiceRole-${platformId}`, {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
      ]
    });

    const fleet = new codebuild.Fleet(this, `Fleet-${toStackName(props.arch)}`, {
      ...(props.fleetProps || CodeBuildStackDefaultProps.fleetProps),
      environmentType: props.environmentType
    });

    const imageId: string = machineImage.getImage(this).imageId;

    const cfnFleet = fleet.node.defaultChild as cdk.CfnResource;
    cfnFleet.addPropertyOverride('ImageId', imageId);
    cfnFleet.addPropertyOverride('FleetServiceRole', fleetServiceRole.roleArn);

    const codebuildProject = new codebuild.Project(this, id, {
      projectName: props.projectName,
      source: githHubSource,
      environment: {
        ...(props.projectEnvironmentProps || CodeBuildStackDefaultProps.projectEnvironmentProps),
        fleet: fleet,
        buildImage: this.getBuildImageByOS(props.buildImageOS, props.environmentType, imageId)
      },
      encryptionKey: new Key(this, `codebuild-${platformId}-key-${props.region}`, {
        description: 'Kms Key to encrypt data-at-rest',
        alias: `finch-${platformId}-kms-${props.region}`,
        enabled: true
      })
    });

    codebuildProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [secretArn]
      })
    );

    return codebuildProject;
  }

  private getBuildImageByOS(
    os: BuildImageOS,
    environmentType: codebuild.EnvironmentType,
    imageId: string
  ): cdk.aws_codebuild.IBuildImage {
    switch (os) {
      case BuildImageOS.LINUX:
        return new LinuxAMIBuildImage(imageId, environmentType);
      case BuildImageOS.MAC:
        return new MacAMIBuildImage(imageId, environmentType);
      case BuildImageOS.WINDOWS:
        return new WindowsAMIBuildImage(imageId, environmentType);
      default:
        throw new Error(`Unsupported Build Image OS: ${os}`);
    }
  }
}
