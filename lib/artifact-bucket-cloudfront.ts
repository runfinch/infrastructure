import * as cdk from 'aws-cdk-lib';
import { CfnOutput } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { CloudfrontCdn } from './cloudfront_cdn';
import * as s3Deployment from 'aws-cdk-lib/aws-s3-deployment';
import { applyTerminationProtectionOnStacks } from './aspects/stack-termination-protection';

export class ArtifactBucketCloudfrontStack extends cdk.Stack {
  public readonly urlOutput: CfnOutput;
  public readonly bucket: s3.Bucket;
  constructor(scope: Construct, id: string, stage: string, props?: cdk.StackProps) {
    super(scope, id, props);
    applyTerminationProtectionOnStacks([this]);

    const bucketName = `finch-artifact-bucket-${stage.toLowerCase()}-${cdk.Stack.of(this)?.account}`;
    const artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      bucketName,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });

    // upload the file for integration testing puporse
    new s3Deployment.BucketDeployment(this, 'DeployTestFile', {
      sources: [s3Deployment.Source.asset('./assets')],
      destinationBucket: artifactBucket,
      prune: false
    });

    const cloudfrontCdn = new CloudfrontCdn(this, 'ArtifactCloudfrontCdn', {
      bucket: artifactBucket
    });
    this.bucket = artifactBucket;
    this.urlOutput = cloudfrontCdn.urlOutput;
  }
}
