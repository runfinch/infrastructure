import config from './config.json';

interface envProps {
  account: string;
  region: string;
}

class ConfigClass {
  public readonly envPipeline: envProps;
  public readonly envBeta: envProps;
  public readonly envProd: envProps;
  public readonly envRelease: envProps;

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

export const Config = new ConfigClass(config);
