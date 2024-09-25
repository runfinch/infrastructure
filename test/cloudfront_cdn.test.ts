import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { CloudfrontCdn } from '../lib/cloudfront_cdn';

describe('CloudfrontCdn', () => {
  test('synthesizes the way we expect', () => {
    const app = new cdk.App();

    // create a stack for CloudfrontCdn to live in
    const cloudfrontCdnStack = new cdk.Stack(app, 'CloudfrontCdnStack');
    const bucket = new s3.Bucket(cloudfrontCdnStack, 'TestBucket', {
      bucketName: 'test-bucket',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });

    // create the CloudfrontCdn stack for assertions
    const cloudfrontCdn = new CloudfrontCdn(cloudfrontCdnStack, 'CloudfrontCdn', {
      bucket: bucket
    });

    const template = Template.fromStack(cloudfrontCdnStack);

    // assert it creates the s3 bucket
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.hasResource('AWS::S3::Bucket', {
      Properties: {
        BucketName: 'test-bucket',
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

    const bukcetLogicalId = cloudfrontCdnStack.getLogicalId(bucket.node.defaultChild as CfnBucket);
    // assert the bucket policy
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      Bucket: {
        Ref: bukcetLogicalId
      },
      PolicyDocument: {
        Statement: [
          Match.objectLike({
            Action: 's3:GetObject',
            Effect: 'Allow',
            Principal: {
              CanonicalUser: {
                'Fn::GetAtt': [Match.anyValue(), 'S3CanonicalUserId']
              }
            },
            Resource: {
              'Fn::Join': [
                '',
                [
                  {
                    'Fn::GetAtt': [bukcetLogicalId, 'Arn']
                  },
                  '/*'
                ]
              ]
            }
          })
        ],
        Version: '2012-10-17'
      }
    });

    // assert it creates the cloudfront distribution
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    // the cloufront has a s3 origin and OAI to access the s3 bucket
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultCacheBehavior: {
          AllowedMethods: ['GET', 'HEAD']
        },
        Origins: [
          {
            DomainName: {
              'Fn::GetAtt': [Match.anyValue(), 'RegionalDomainName']
            },
            Id: Match.anyValue(),
            S3OriginConfig: {
              OriginAccessIdentity: {
                'Fn::Join': [
                  '',
                  [
                    'origin-access-identity/cloudfront/',
                    {
                      Ref: Match.anyValue()
                    }
                  ]
                ]
              }
            }
          }
        ]
      }
    });

    template.hasResourceProperties('AWS::CloudFront::CloudFrontOriginAccessIdentity', {
      CloudFrontOriginAccessIdentityConfig: {
        Comment: 'OAI for artifact bucket cloudfront'
      }
    });
  });
});
