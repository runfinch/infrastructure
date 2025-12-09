import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { CfnOutput, Stack } from 'aws-cdk-lib';
import { CloudfrontMonitoringStack } from './cloudfront-monitoring-stack';

interface CloudfrontCdnProps {
  bucket: s3.Bucket;
}

export class CloudfrontCdn extends Construct {
  public readonly urlOutput: CfnOutput;
  constructor(parent: Stack, id: string, props: CloudfrontCdnProps) {
    super(parent, id);

    const cloudfrontOAI = new cloudfront.OriginAccessIdentity(this, 'cloudfront-OAI', {
      comment: 'OAI for artifact bucket cloudfront'
    });

    props.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [props.bucket.arnForObjects('*')],
        principals: [new iam.CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
      })
    );
    new CfnOutput(this, 'S3 bucket', { value: props.bucket.bucketName });

    const distribution = new cloudfront.Distribution(this, 'ArtifactBucketDistribution', {
      defaultBehavior: {
        origin: new cloudfront_origins.S3Origin(props.bucket, {
          originAccessIdentity: cloudfrontOAI
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD
      }
    });
    new CfnOutput(this, 'Distribution Id', {
      value: distribution.distributionId
    });
    this.urlOutput = new CfnOutput(this, 'Distribution Domain', {
      value: distribution.domainName
    });

    new CloudfrontMonitoringStack(this, `${id}-Monitoring`, {
      distributionId: distribution.distributionId
    });
  }
}
