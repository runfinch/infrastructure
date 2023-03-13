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
  Prod,
  Release
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

    // set the availability zone.
    const availabilityZones = this.node.tryGetContext('availabilityZones');
    console.debug("availability zones from context: " + availabilityZones);
    // TODO: Improve the availability zone selection logic. Instead of assigning default availability zone, we can throw exception
    // when availability zone from context is empty.
    const selectedAvailabilityZone = availabilityZones?.at(-1) ?? config.defaultAvailabilityZone;
    console.debug("selectedAvailabilityZone: " + selectedAvailabilityZone);
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

  private ReleaseRunnerStack: MacConfig[] = [
<<<<<<< HEAD
    {'stackName':'macOS12amd64StackRelease', 'ver':'12.6','arch':'x86_64_mac', 'defaultAvailabilityZone': 'us-east-2c'},
    {'stackName':'macOS12arm64StackRelease', 'ver':'12.6','arch':'arm64_mac', 'defaultAvailabilityZone': 'us-east-2c'},
    {'stackName':'macOS11amd64StackRelease', 'ver':'11.7','arch':'x86_64_mac', 'defaultAvailabilityZone': 'us-east-2c'},
    {'stackName':'macOS11arm64StackRelease', 'ver':'11.7','arch':'arm64_mac', 'defaultAvailabilityZone': 'us-east-2c'},
    {'stackName':'macOS13arm64StackRelease', 'ver':'13.0','arch':'arm64_mac', 'defaultAvailabilityZone': 'us-east-2c'},
    {'stackName':'macOS13amd64StackRelease', 'ver':'13.0','arch':'x86_64_mac', 'defaultAvailabilityZone': 'us-east-2c'},
    {'stackName':'macOS10amd64StackRelease', 'ver':'10.15','arch':'x86_64_mac', 'defaultAvailabilityZone': 'us-east-2c'},
=======
    {'stackName':'macOS12amd64StackRelease', 'ver':'12.6','arch':'x86_64_mac', "defaultAvailabilityZone": "us-east-2c"},
    {'stackName':'macOS12arm64StackRelease', 'ver':'12.6','arch':'arm64_mac', "defaultAvailabilityZone": "us-east-2c"},
    {'stackName':'macOS11amd64StackRelease', 'ver':'11.7','arch':'x86_64_mac', "defaultAvailabilityZone": "us-east-2c"},
    {'stackName':'macOS11arm64StackRelease', 'ver':'11.7','arch':'arm64_mac', "defaultAvailabilityZone": "us-east-2c"},
    {'stackName':'macOS13arm64StackRelease', 'ver':'13.0','arch':'arm64_mac', "defaultAvailabilityZone": "us-east-2c"},
    {'stackName':'macOS13amd64StackRelease', 'ver':'13.0','arch':'x86_64_mac', "defaultAvailabilityZone": "us-east-2c"},
    {'stackName':'macOS10amd64StackRelease', 'ver':'10.15','arch':'x86_64_mac', "defaultAvailabilityZone": "us-east-2c"},
>>>>>>> a47af06 (change to us-east-2c)
  ]

  constructor(scope: Construct, id: string, props: FinchPipelineAppStageProps) {
    super(scope, id, props);

    if (props.environmentStage === ENVIRONMENT_STAGE.Beta) {
      this.BetaRunnerStack.forEach((runner: MacConfig) => {
       this.createMacRunnerStack(props, runner); 
      });
    } else if (props.environmentStage === ENVIRONMENT_STAGE.Prod) {
      this.ProdRunnerStack.forEach((runner: MacConfig) => {
        this.createMacRunnerStack(props, runner);
      })
    } else {
      this.ReleaseRunnerStack.forEach((runner: MacConfig) => {
        this.createMacRunnerStack(props, runner)
      })
    }

    const artifactBucketCloudfrontStack = new ArtifactBucketCloudfrontStack(this, 'ArtifactCloudfront', this.stageName);
    this.artifactBucketCloudfrontUrlOutput = artifactBucketCloudfrontStack.urlOutput;
    this.cloudfrontBucket = artifactBucketCloudfrontStack.bucket;

    new ContinuousIntegrationStack(this, 'FinchContinuousIntegrationStack', this.stageName);
    new PVREReportingStack(this, 'PVREReportingStack');
  }
}
