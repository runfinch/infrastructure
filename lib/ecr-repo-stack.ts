import * as cdk from 'aws-cdk-lib';
import { CfnOutput } from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
import { applyTerminationProtectionOnStacks } from './aspects/stack-termination-protection';

export class ECRRepositoryStack extends cdk.Stack {
  public readonly repositoryOutput: CfnOutput;
  public readonly repository: ecr.Repository;
  public readonly osBuildCacheRepositoryOutput: CfnOutput;
  public readonly osBuildCacheRepository: ecr.Repository;
  
  constructor(scope: Construct, id: string, stage: string, props?: cdk.StackProps) {
    super(scope, id, props);
    applyTerminationProtectionOnStacks([this]);

    const repoName = `finch-rootfs-image-${stage.toLowerCase()}`;
    const ecrRepository = new ecr.Repository(this, 'finch-rootfs', {
        repositoryName:repoName,
        imageTagMutability: ecr.TagMutability.IMMUTABLE,
        // TODO: CFN does not provide APIs for enhanced image scanning.
        // To address, create a custom stack that uses the AWS sdk to change the account ECR
        // scanning settings to enhanced.

        // For now, scan on image push is set to true. This means that the image will be scanned
        // for vulnerabilites every time it is pushed up to the ECR repo. With enhanced scanning,
        // the image would be continously scanned for vulnerabilities.
        // See https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning-enhanced.html
        imageScanOnPush: true,
    });

    this.repository = ecrRepository
    this.repositoryOutput = new CfnOutput(this, 'ECR repository', { value: ecrRepository.repositoryName });

    // This repository is needed to hold build caches for Finch's OS builds.
    const osBuildCacheRepoName = `finch-os-build-cache-${stage.toLowerCase()}`;
    const osBuildCacheRepository = new ecr.Repository(this, 'finch-os-build-cache', {
      repositoryName: osBuildCacheRepoName,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      imageScanOnPush: false,
      lifecycleRules: [
        {
          description: 'Expire untagged build cache layers after 30 days',
          tagStatus: ecr.TagStatus.UNTAGGED,
          maxImageAge: cdk.Duration.days(30),
        },
      ],
    });

    this.osBuildCacheRepository = osBuildCacheRepository;
    this.osBuildCacheRepositoryOutput = new CfnOutput(this, 'ECR OS build cache repository', { value: osBuildCacheRepository.repositoryName });
  }
}
