import * as cdk from 'aws-cdk-lib';
import { CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ArtifactBucketCloudfrontStack } from './artifact-bucket-cloudfront';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { ASGRunnerStack } from './asg-runner-stack';
import { ContinuousIntegrationStack } from './continuous-integration-stack';
import { ECRRepositoryStack } from './ecr-repo-stack';
import { PVREReportingStack } from './pvre-reporting-stack';
import { PlatformType, RunnerProps } from '../config/runner-config';
import { EventBridgeScanNotifsStack } from './event-bridge-scan-notifs-stack';

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
  ecrRepositoryOutput: CfnOutput;
  public readonly cloudfrontBucket: s3.Bucket;
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props: FinchPipelineAppStageProps) {
    super(scope, id, props);
    props.runnerConfig.runnerTypes.forEach((runnerType) => {
      const ASGStackName = `ASG-${runnerType.platform}-${runnerType.repo}-${runnerType.version.split('.')[0]}-${runnerType.arch}Stack`;
      const licenseArn =
        runnerType.platform === PlatformType.WINDOWS
          ? props.runnerConfig.windowsLicenseArn
          : props.runnerConfig.macLicenseArn;
      new ASGRunnerStack(this, ASGStackName, {
        env: props.env,
        stage: props.environmentStage,
        licenseArn: licenseArn,
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

      const ecrRepositoryStack = new ECRRepositoryStack(this, 'ECRRepositoryStack', this.stageName);

      this.ecrRepositoryOutput = ecrRepositoryStack.repositoryOutput;
      this.ecrRepository = ecrRepositoryStack.repository;

      // Only report rootfs image scans in prod to avoid duplicate notifications.
      if (props.environmentStage == ENVIRONMENT_STAGE.Prod) {
        new EventBridgeScanNotifsStack(this, 'EventBridgeScanNotifsStack', this.stageName);
      }

      new ContinuousIntegrationStack(this, 'FinchContinuousIntegrationStack', this.stageName, {
        rootfsEcrRepository: this.ecrRepository
      });
    }

    new PVREReportingStack(this, 'PVREReportingStack', { terminationProtection: true });
  }
}
