import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ArtifactBucketCloudfrontStack } from '../lib/artifact-bucket-cloudfront';

describe('ArtifactBucketCloudfrontStack', () => {
  test('synthesizes the way we expect', () => {
    const app = new cdk.App();
    const cloudfront = new ArtifactBucketCloudfrontStack(app, 'CloudfrontStack', 'test');

    // prepare the ArtifactBucketCloudfrontStack template for assertions
    const template = Template.fromStack(cloudfront);

    // assert it creates the s3 bucket
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.hasResource('AWS::S3::Bucket', {
      Properties: {
        BucketName: Match.anyValue(),
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true
        }
      },
      UpdateReplacePolicy: 'Retain',
      DeletionPolicy: 'Retain'
    });

    // assert it creates the cloudfront distribution
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });
});
