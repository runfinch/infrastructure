import config from './runner-config.json';

export interface RunnerProps {
  macLicenseArn: string;
  windowsLicenseArn: string;
  runnerTypes: Array<RunnerType>;
}

export interface RunnerType {
  platform: PlatformType;
  version: string; // e.g. 13.2 if platform == macOS, 2022 if platform == windows
  arch: string;
  repo: string;
  desiredInstances: number;
  availabilityZones: Array<string>;
}

export enum PlatformType {
  WINDOWS = 'windows',
  MAC = 'mac'
}

/**
 * Class for runner configurations. Outlines self hosted license arn and an
 * array of runner types to create using an auto scaling group.
 */
class RunnerConfigClass {
  public readonly runnerBeta: RunnerProps;
  public readonly runnerProd: RunnerProps;
  public readonly runnerRelease: RunnerProps;

  constructor(configFile: any) {
    if (!configFile.runnerBeta) {
      throw new Error('Error: Beta runner config must be specified.');
    }
    this.runnerBeta = configFile.runnerBeta;

    if (!configFile.runnerProd) {
      throw new Error('Error: Prod runner config must be specified.');
    }
    this.runnerProd = configFile.runnerProd;

    if (!configFile.runnerRelease) {
      throw new Error('Error: Release runner config must be specified.');
    }
    this.runnerRelease = configFile.runnerRelease;
  }
}

export const RunnerConfig = new RunnerConfigClass(config);
