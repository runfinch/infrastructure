import config from './runner-config.json';

export interface RunnerProps {
  macLicenseArn: string;
  windowsLicenseArn: string;
  linuxLicenseArn: string;
  runnerTypes: Array<RunnerType>;
}

export interface RunnerType {
  platform: PlatformType;
  /** Different values for different platforms.
   * For mac, a version like 13.2
   * For windows, a server version like 2022
   * For amazonlinux, either 2, 2023, etc.
   * For fedora, a version like 40, 41, etc. */
  version: string;
  arch: string;
  repo: string;
  desiredInstances: number;
  availabilityZones: Array<string>;
  /**
   * Optional: pin the ASG to a specific launch template version number
   * (e.g. "14") instead of tracking the launch template's latest version.
   *
   * When set, the ASG references this exact version, so a deploy that does
   * not change this value leaves the ASG's LaunchTemplateSpecification
   * unchanged and therefore does NOT trigger a rolling update / instance
   * replacement. Use this to apply stack changes to dedicated-host (mac)
   * runners without recycling the running instances (scarce metal capacity).
   *
   * Set it to the version the ASG's instances are currently running. To
   * intentionally roll instances onto a newer launch template version, bump
   * this value (or remove it to resume tracking the latest version).
   *
   * When omitted, the ASG tracks the launch template's LatestVersionNumber
   * (the prior behavior), so each deploy that creates a new version rolls the
   * instances.
   */
  launchTemplateVersion?: string;
}

export const enum PlatformType {
  WINDOWS = 'windows',
  MAC = 'mac',
  AMAZONLINUX = 'amazonlinux',
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
