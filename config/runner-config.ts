import config from './runner-config.json';

export interface RunnerProps {
  licenseArn: string;
  runnerTypes: Array<RunnerType>;
}

export interface RunnerType {
  macOSVersion: string;
  arch: string;
  repo: string;
  desiredInstances: number;
  availabilityZones: Array<string>;
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
