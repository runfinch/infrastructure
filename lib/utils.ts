import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { EnvConfig } from '../config/env-config';

export const getMacBaseCapacityForAccount = (accountId?: string): number => {
  // Account specific configuration has been removed for now,
  // as we are facing capacity issues with the dedicated mac instances.
  return 1;
}

export enum BuildImageOS {
  LINUX = 'linux',
  WINDOWS = 'windows',
  MAC = 'mac'
}

export interface CodeBuildStackArgs {
  project: string;
  operatingSystem: string;
  arch: string;
  amiSearchString: string;
  environmentType: codebuild.EnvironmentType;
  buildImageOS: BuildImageOS;
  fleetProps?: {
    computeType: codebuild.FleetComputeType;
    baseCapacity: number;
  };
  buildImageString?: codebuild.IBuildImage,
  projectEnvironmentProps?: {
    computeType: codebuild.ComputeType;
  };
}

/**
 * Get CodeBuild stacks configuration with account-specific capacity
 */
export const getCodeBuildStacks = (accountId?: string): CodeBuildStackArgs[] => {
  const stacks: CodeBuildStackArgs[] = [
    {
      project: 'finch',
      operatingSystem: 'ubuntu',
      arch: 'x86_64',
      amiSearchString: 'ubuntu/images/hvm-ssd-gp3/ubuntu*24.04*',
      environmentType: codebuild.EnvironmentType.LINUX_EC2,
      buildImageOS: BuildImageOS.LINUX
    },
    {
      project: 'finch',
      operatingSystem: 'ubuntu',
      arch: 'arm64',
      amiSearchString: 'ubuntu/images/hvm-ssd-gp3/ubuntu*24.04*', // TODO: make this more robust
      environmentType: codebuild.EnvironmentType.ARM_EC2,
      buildImageOS: BuildImageOS.LINUX,
      fleetProps: {
        computeType: codebuild.FleetComputeType.LARGE,
        baseCapacity: 1,
      }
    },
    {
      project: 'finch-daemon',
      operatingSystem: 'macOS26',
      arch: 'arm64',
      amiSearchString: "",
      environmentType: codebuild.EnvironmentType.MAC_ARM,
      buildImageOS: BuildImageOS.MAC,
      buildImageString: codebuild.MacBuildImage.BASE_26,
      fleetProps: {
        computeType: codebuild.FleetComputeType.MEDIUM,
        baseCapacity: getMacBaseCapacityForAccount(accountId)
      },
    }
  ];

  // Only deploy SAM CLI integration test stack in prod
  if (accountId === EnvConfig.envProd.account) {
    stacks.push({
      project: 'finch',
      operatingSystem: 'macOS26-samcli',
      arch: 'arm64',
      amiSearchString: "",
      environmentType: codebuild.EnvironmentType.MAC_ARM,
      buildImageOS: BuildImageOS.MAC as BuildImageOS.MAC,
      buildImageString: codebuild.MacBuildImage.BASE_26,
      fleetProps: {
        computeType: codebuild.FleetComputeType.MEDIUM,
        baseCapacity: getMacBaseCapacityForAccount(accountId)
      },
    })
  }

  return stacks;
}

// Create const with default configuration for backwards compatibility
export const CODEBUILD_STACKS: CodeBuildStackArgs[] = getCodeBuildStacks();

// members of the runfinch org (+dependabot)
// curl -s https://api.github.com/users/<username> | jq '.id'
// TODO: automate fetching account ID's
export const GITHUB_ALLOWLISTED_ACCOUNT_IDS = [
  '47769978', // coderbirju
  '2967759', // henry118
  '47723536', // Shubhranshu153
  '55555210', // sondavidb
  '59450965', // cezar-r
  '135386930', // cartrius
  '23559763', // Swapnanil-Gupta
  '219054581', // ayush-panta
  '71107651', // smandhada16
  '10296556', // KlwntSingh
  '135713015', // shashank-boyapally
  '49699333' // dependabot[bot] github app
];

/**
 * Replaces all underscores with hyphens in a string.
 * Used for making strings compatible with stack names, which don't allow "_" in the name.
 *
 * @param name The string to process
 * @returns A new string with all underscores replaced by hyphens
 */
export const toStackName = (name: string) => {
  return name.replace(/_/g, '-');
};

// @ts-expect-error Extending private class
export class LinuxAMIBuildImage extends codebuild.LinuxBuildImage implements codebuild.IBuildImage {
  declare type: codebuild.EnvironmentType;

  constructor(imageId: string, environmentType: codebuild.EnvironmentType) {
    // @ts-expect-error Extending private class
    super({ imageId });
    this.type = environmentType;
  }
}

// @ts-expect-error Extending private class
export class WindowsAMIBuildImage extends codebuild.WindowsBuildImage implements codebuild.IBuildImage {
  declare type: codebuild.EnvironmentType;

  constructor(imageId: string, environmentType: codebuild.EnvironmentType) {
    // @ts-expect-error Extending private class
    super({ imageId });
    this.type = environmentType;
  }
}

// @ts-expect-error Extending private class
export class MacAMIBuildImage extends codebuild.LinuxBuildImage implements codebuild.IBuildImage {
  declare type: codebuild.EnvironmentType;

  constructor(imageId: string, environmentType: codebuild.EnvironmentType) {
    // @ts-expect-error Extending private class
    super({ imageId });
    this.type = environmentType;
  }
}
