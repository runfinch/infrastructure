import * as codebuild from 'aws-cdk-lib/aws-codebuild';


export const CODEBUILD_ARCHS: string[] = ['x86_64_ubuntu', 'arm64_ubuntu'];

// members of the runfinch org (+dependabot)
// curl -s https://api.github.com/users/<username> | jq '.id'
// TODO: automate fetching account ID's
export const GITHUB_ALLOWLISTED_ACCOUNT_IDS = [
    '47769978',     // coderbirju
    '424987',       // pendo324
    '55906459',     // austinvazquez
    '2304727',      // Kern--
    '2967759',      // henry118
    '47723536',     // Shubhranshu153
    '55555210',     // sondavidb
    '5525370',      // swagatbora90
    '59450965',     // cezar-r
    '49699333',     // dependabot[bot] github app
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
}

export enum BuildImageOS {
  LINUX = "linux",
  WINDOWS = "windows",
  MAC = "mac",
}

// @ts-expect-error Extending private class
export class LinuxAMIBuildImage extends codebuild.LinuxBuildImage implements codebuild.IBuildImage {
    declare type: codebuild.EnvironmentType;
    
    constructor(imageId: string) {
        // @ts-expect-error Extending private class
        super({ imageId });
        this.type = codebuild.EnvironmentType.LINUX_EC2;
    }
}

// @ts-expect-error Extending private class
export class WindowsAMIBuildImage extends codebuild.WindowsBuildImage implements codebuild.IBuildImage {
    declare type: codebuild.EnvironmentType;

    constructor(imageId: string) {
        // @ts-expect-error Extending private class
        super({ imageId });
        this.type = codebuild.EnvironmentType.WINDOWS_EC2;
    }
}

// @ts-expect-error Extending private class
export class MacAMIBuildImage extends codebuild.LinuxBuildImage implements codebuild.IBuildImage {
    declare type: codebuild.EnvironmentType;

    constructor(imageId: string) {
        // @ts-expect-error Extending private class
        super({ imageId });
        this.type = codebuild.EnvironmentType.MAC_ARM;
    }
}
