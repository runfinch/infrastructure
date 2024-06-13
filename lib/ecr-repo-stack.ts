import * as cdk from 'aws-cdk-lib';
import { CfnOutput } from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
import { applyTerminationProtectionOnStacks } from './aspects/stack-termination-protection';

export class ECRRepositoryStack extends cdk.Stack {
  public readonly repositoryOutput: CfnOutput;
  public readonly repository: ecr.Repository;
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
  }
}
