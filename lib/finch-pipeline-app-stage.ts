import * as cdk from 'aws-cdk-lib';
import { CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ArtifactBucketCloudfrontStack } from './artifact-bucket-cloudfront';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { ASGRunnerStack } from './asg-runner-stack';
import { ContinuousIntegrationStack } from './continuous-integration-stack';
import { PVREReportingStack } from './pvre-reporting-stack';
import { RunnerProps } from '../config/runner-config';

export enum ENVIRONMENT_STAGE {
  Beta,
  Prod,
  Release
}

interface FinchPipelineAppStageProps extends cdk.StageProps {
  environmentStage: ENVIRONMENT_STAGE;
  runnerConfig: RunnerProps;
}

export class FinchPipelineAppStage extends cdk.Stage {
  artifactBucketCloudfrontUrlOutput: CfnOutput;
  public readonly cloudfrontBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: FinchPipelineAppStageProps) {
    super(scope, id, props);
    props.runnerConfig.runnerTypes.forEach((runnerType) => {
      const ASGStackName = 'ASG' + '-' + runnerType.repo + '-' + runnerType.macOSVersion.split('.')[0] + '-' + runnerType.arch + 'Stack'
      new ASGRunnerStack(this, ASGStackName , {
        env: props.env,
        stage: props.environmentStage,
        licenseArn: props.runnerConfig.licenseArn,
        type: runnerType
      });
    });

    if (props.environmentStage !== ENVIRONMENT_STAGE.Release) {
      const artifactBucketCloudfrontStack = new ArtifactBucketCloudfrontStack(
        this,
        'ArtifactCloudfront',
        this.stageName
      );
      this.artifactBucketCloudfrontUrlOutput = artifactBucketCloudfrontStack.urlOutput;
      this.cloudfrontBucket = artifactBucketCloudfrontStack.bucket;

      new ContinuousIntegrationStack(this, 'FinchContinuousIntegrationStack', this.stageName);
    }

    new PVREReportingStack(this, 'PVREReportingStack');
  }
}
