import * as cdk from 'aws-cdk-lib';
import { CfnOutput } from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { PlatformType, RunnerProps } from '../config/runner-config';
import { ArtifactBucketCloudfrontStack } from './artifact-bucket-cloudfront';
import { ASGRunnerStack } from './asg-runner-stack';
import { applyTerminationProtectionOnStacks } from './aspects/stack-termination-protection';
import { CodeBuildStack } from './codebuild-stack';
import { ContinuousIntegrationStack } from './continuous-integration-stack';
import { ECRRepositoryStack } from './ecr-repo-stack';
import { EventBridgeScanNotifsStack } from './event-bridge-scan-notifs-stack';
import { PVREReportingStack } from './pvre-reporting-stack';
import { SSMPatchingStack } from './ssm-patching-stack';
import { getCodeBuildStacks, toStackName } from './utils';

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
    applyTerminationProtectionOnStacks([this]);
    props.runnerConfig.runnerTypes.forEach((runnerType) => {
      const ASGStackName = `ASG-${runnerType.platform}-${runnerType.repo}-${runnerType.version.split('.')[0]}-${runnerType.arch}Stack`;
      let licenseArn: string | undefined;
      switch (runnerType.platform) {
        case PlatformType.MAC: {
          licenseArn = props.runnerConfig.macLicenseArn;
          break;
        }
        case PlatformType.WINDOWS: {
          licenseArn = props.runnerConfig.windowsLicenseArn;
          break;
        }
      }
      new ASGRunnerStack(this, ASGStackName, {
        env: props.env,
        stage: props.environmentStage,
        type: runnerType,
        licenseArn
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

    new SSMPatchingStack(this, 'SSMPatchingStack', { terminationProtection: true });

    // Create Ubuntu Codebuild projects for each arch
    // CodeBuild credentials are account-wide, so creating them multiple times within the for
    // loop causes an error.
    // TODO: refactor CodeBuildStack into CodeBuildProjects and loop inside of the constructor.
    const codebuildCredsStack = new (class CodeBuildCredentialsStack extends cdk.Stack {
      constructor(scope: Construct, id: string) {
        super(scope, id, {
          ...props,
          terminationProtection: true,
        });
        new codebuild.GitHubSourceCredentials(this, `code-build-credentials`, {
          accessToken: cdk.SecretValue.secretsManager('codebuild-github-access-token')
        });
      }
    })(this, 'CodeBuildStack-credentials');

    for (const { project, arch, operatingSystem, amiSearchString, environmentType, buildImageOS, buildImageString, fleetProps, projectEnvironmentProps } of getCodeBuildStacks(props.env?.account)) {
      let codeBuildStack;
      codeBuildStack = new CodeBuildStack(this, `CodeBuildStack-${operatingSystem}-${toStackName(arch)}`, {
        repo: project,
        env: props.env,
        projectName: `${project}-${arch}-${props.environmentStage}-instance`,
        region: 'us-west-2',
        arch,
        amiSearchString,
        operatingSystem,
        buildImageOS: buildImageOS,
        environmentType: environmentType,
        buildImageString,
        fleetProps,
        projectEnvironmentProps
      });
      codeBuildStack.addDependency(codebuildCredsStack);
    }
  }
}
