import * as cdk from 'aws-cdk-lib';
import config from './env-config.json';

/**
 * Class for environment configurations. Outlines the account and region.
 */
class EnvConfigClass {
  public readonly envPipeline: cdk.Environment;
  public readonly envBeta: cdk.Environment;
  public readonly envProd: cdk.Environment;
  public readonly envRelease: cdk.Environment;

  constructor(configFile: any) {
    if (!configFile.envPipeline) {
      throw new Error('Error: envPipeline must be specified.');
    }
    this.envPipeline = configFile.envPipeline;

    if (!configFile.envBeta) {
      throw new Error('Error: envBeta must be specified.');
    }
    this.envBeta = configFile.envBeta;

    if (!configFile.envProd) {
      throw new Error('Error: envProd must be specified.');
    }
    this.envProd = configFile.envProd;

    if (!configFile.envRelease) {
      throw new Error('Error: envRelease must be specified.');
    }
    this.envRelease = configFile.envRelease;
  }
}

export const EnvConfig = new EnvConfigClass(config);
