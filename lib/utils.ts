import * as codebuild from 'aws-cdk-lib/aws-codebuild';

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

export const CODEBUILD_STACKS: CodeBuildStackArgs[] = [
  {
    project: 'finch',
    operatingSystem: 'ubuntu',
    arch: 'x86_64',
    amiSearchString: 'ubuntu/images/hvm-ssd/ubuntu*22.04*',
    environmentType: codebuild.EnvironmentType.LINUX_EC2,
    buildImageOS: BuildImageOS.LINUX
  },
  {
    project: 'finch',
    operatingSystem: 'ubuntu',
    arch: 'arm64',
    amiSearchString: 'ubuntu/images/hvm-ssd/ubuntu*22.04*',
    environmentType: codebuild.EnvironmentType.ARM_EC2,
    buildImageOS: BuildImageOS.LINUX,
    fleetProps: {
      computeType: codebuild.FleetComputeType.LARGE,
      baseCapacity: 1,
    }
  },
  {
    project: 'finch-daemon',
    operatingSystem: 'macOS',
    arch: 'arm64',
    amiSearchString: "", // Empty string since we're using buildImageString directly
    environmentType: codebuild.EnvironmentType.MAC_ARM,
    buildImageOS: BuildImageOS.MAC,
    buildImageString: codebuild.MacBuildImage.BASE_14,
    fleetProps: {
      computeType: codebuild.FleetComputeType.MEDIUM,
      baseCapacity: 5 // limit is 5 total runners
    },
  }
];

// members of the runfinch org (+dependabot)
// curl -s https://api.github.com/users/<username> | jq '.id'
// TODO: automate fetching account ID's
export const GITHUB_ALLOWLISTED_ACCOUNT_IDS = [
  '47769978', // coderbirju
  '424987', // pendo324
  '2304727', // Kern--
  '2967759', // henry118
  '47723536', // Shubhranshu153
  '55555210', // sondavidb
  '5525370', // swagatbora90
  '59450965', // cezar-r
  '135386930', // cartrius
  '40778211', // channing
  '23559763', // swapnanil gupta
  '219054581', // ayush panta 
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
