import * as cdk from 'aws-cdk-lib';
import { CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ArtifactBucketCloudfrontStack } from './artifact-bucket-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { MacRunnerStack } from './mac-runner-stack';
import { ContinuousIntegrationStack } from './continuous-integration-stack';
import { PVREReportingStack } from './pvre-reporting-stack';

export enum ENVIRONMENT_STAGE {
  Beta,
  Prod
}

interface FinchPipelineAppStageProps extends cdk.StageProps {
  environmentStage: ENVIRONMENT_STAGE;
}

interface MacConfig {
  stackName: string,
  ver: string,
  arch: string,
  defaultAvailabilityZone: string,
}

export class FinchPipelineAppStage extends cdk.Stage {
  artifactBucketCloudfrontUrlOutput: CfnOutput;
  public readonly cloudfrontBucket: s3.Bucket;
  private createMacRunnerStack(parentProps: FinchPipelineAppStageProps | undefined, config: MacConfig): void {

    //set the availability zone.
    var availabilityZones = this.node.tryGetContext('availabilityZones');
    //TODO: Improve the availability zone selection logic. Instead of assigning default availability zone, we can throw exception
    // when availability zone from context is empty.
    var selectedAvailabilityZone = config.defaultAvailabilityZone;
    if (availabilityZones?.length > 0) {
      console.debug("availability zones from context: " + availabilityZones);
      selectedAvailabilityZone = availabilityZones[availabilityZones.length - 1];
    }
    new MacRunnerStack(this, config.stackName, {
      ...parentProps,
      userDataScriptPath: config.arch == 'x86_64_mac' ? './lib/setup-amd64-runner.sh' : './lib/setup-arm64-runner.sh',
      availabilityZone: selectedAvailabilityZone,
      macOSVersion: config.ver,
      hostType: config.arch == 'x86_64_mac' ? 'mac1.metal' : 'mac2.metal',
      architecture: config.arch,
    });
  }

  private BetaRunnerStack: MacConfig[] = [
    { 'stackName': 'macOS12amd64StackBeta', 'ver': '12.6', 'arch': 'x86_64_mac', 'defaultAvailabilityZone': 'us-west-2d' },
    { 'stackName': 'macOS12arm64StackBeta', 'ver': '12.6', 'arch': 'arm64_mac', 'defaultAvailabilityZone': 'us-west-2d' }
  ];
  private ProdRunnerStack: MacConfig[] = [
    { 'stackName': 'macOS12amd64Stack1', 'ver': '12.6', 'arch': 'x86_64_mac', 'defaultAvailabilityZone': 'us-west-2d' },
    { 'stackName': 'macOS12arm64Stack1', 'ver': '12.6', 'arch': 'arm64_mac', 'defaultAvailabilityZone': 'us-west-2d' },
    { 'stackName': 'macOS11amd64Stack1', 'ver': '11.7', 'arch': 'x86_64_mac', 'defaultAvailabilityZone': 'us-west-2d' },
    { 'stackName': 'macOS11arm64Stack1', 'ver': '11.7', 'arch': 'arm64_mac', 'defaultAvailabilityZone': 'us-west-2d' },
    { 'stackName': 'macOS12amd64Stack2', 'ver': '12.6', 'arch': 'x86_64_mac', 'defaultAvailabilityZone': 'us-west-2d' },
    { 'stackName': 'macOS12arm64Stack2', 'ver': '12.6', 'arch': 'arm64_mac', 'defaultAvailabilityZone': 'us-west-2d' },
    { 'stackName': 'macOS11amd64Stack2', 'ver': '11.7', 'arch': 'x86_64_mac', 'defaultAvailabilityZone': 'us-west-2d' },
    { 'stackName': 'macOS11arm64Stack2', 'ver': '11.7', 'arch': 'arm64_mac', 'defaultAvailabilityZone': 'us-west-2d' },
    { 'stackName': 'macOS12amd64Stack3', 'ver': '12.6', 'arch': 'x86_64_mac', 'defaultAvailabilityZone': 'us-west-2d' },
    { 'stackName': 'macOS12arm64Stack3', 'ver': '12.6', 'arch': 'arm64_mac', 'defaultAvailabilityZone': 'us-west-2d' },
    { 'stackName': 'macOS11amd64Stack3', 'ver': '11.7', 'arch': 'x86_64_mac', 'defaultAvailabilityZone': 'us-west-2d' },
    { 'stackName': 'macOS11arm64Stack3', 'ver': '11.7', 'arch': 'arm64_mac', 'defaultAvailabilityZone': 'us-west-2d' }
  ];

  constructor(scope: Construct, id: string, props?: FinchPipelineAppStageProps) {
    super(scope, id, props);

    if (props?.environmentStage == ENVIRONMENT_STAGE.Beta) {
      this.BetaRunnerStack.forEach(element => {
        this.createMacRunnerStack(props, element);
      });
    } else {
      this.ProdRunnerStack.forEach(element => {
        this.createMacRunnerStack(props, element);
      })
    }

    const artifactBucketCloudfrontStack = new ArtifactBucketCloudfrontStack(this, 'ArtifactCloudfront', this.stageName);
    this.artifactBucketCloudfrontUrlOutput = artifactBucketCloudfrontStack.urlOutput;
    this.cloudfrontBucket = artifactBucketCloudfrontStack.bucket;

    new ContinuousIntegrationStack(this, 'FinchContinuousIntegrationStack', this.stageName);
    new PVREReportingStack(this, 'PVREReportingStack');
  }
}
