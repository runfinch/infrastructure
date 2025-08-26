import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { CloudfrontCdn } from '../lib/cloudfront_cdn';

describe('CloudfrontCdn', () => {
  let app: cdk.App;
  let cloudfrontCdnStack: cdk.Stack;
  let bucket: s3.Bucket;
  let cloudfrontCdn: CloudfrontCdn;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    cloudfrontCdnStack = new cdk.Stack(app, 'CloudfrontCdnStack');
    bucket = new s3.Bucket(cloudfrontCdnStack, 'TestBucket', {
      bucketName: 'test-bucket',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });
    cloudfrontCdn = new CloudfrontCdn(cloudfrontCdnStack, 'CloudfrontCdn', {
      bucket: bucket
    });
    template = Template.fromStack(cloudfrontCdnStack);
  });

  test('synthesizes the way we expect', () => {
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

  describe('CloudWatch Monitoring', () => {
    test('creates CloudWatch alarms for error rate and latency', () => {
      // The monitoring resources are created in the same stack, not nested
      template.resourceCountIs('AWS::CloudWatch::Alarm', 2);

      // Assert High Error Rate Alarm
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmDescription: 'CloudFront distribution has high error rate',
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 2,
        MetricName: 'TotalErrorRate',
        Namespace: 'AWS/CloudFront',
        Statistic: 'Average',
        Threshold: 5,
        TreatMissingData: 'notBreaching'
      });

      // Assert High Origin Latency Alarm
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmDescription: 'CloudFront distribution has high origin latency',
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 3,
        MetricName: 'OriginLatency',
        Namespace: 'AWS/CloudFront',
        Statistic: 'Average',
        Threshold: 3000,
        TreatMissingData: 'notBreaching'
      });
    });

    test('creates CloudWatch dashboard with all metrics', () => {
      // Assert that 1 CloudWatch dashboard is created
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);

      // Just verify the dashboard exists with the right name pattern
      template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardName: {
          'Fn::Join': [
            '',
            [
              'CloudFront-',
              {
                Ref: Match.anyValue()
              },
              '-Dashboard'
            ]
          ]
        }
      });

      // Verify the dashboard body contains widgets (it's a complex Fn::Join structure)
      template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardBody: {
          'Fn::Join': [
            '',
            Match.arrayWith([
              Match.stringLikeRegexp('.*widgets.*')
            ])
          ]
        }
      });
    });

    test('alarm names include distribution ID', () => {
      // Get all alarm resources and check their names
      const alarms = template.findResources('AWS::CloudWatch::Alarm');
      
      expect(Object.keys(alarms)).toHaveLength(2);
      
      Object.values(alarms).forEach((alarm: any) => {
        expect(alarm.Properties.AlarmName).toEqual({
          'Fn::Join': [
            '',
            [
              'CloudFront-',
              expect.any(Object), // This will be the distribution ID reference
              expect.any(String)  // This will be the alarm suffix like '-HighErrorRate'
            ]
          ]
        });
      });
    });

    test('dashboard contains all expected metric types', () => {
      const dashboards = template.findResources('AWS::CloudWatch::Dashboard');
      const dashboardBody = Object.values(dashboards)[0] as any;
      
      // The dashboard body is a complex Fn::Join - just verify it contains key metric names
      const bodyString = JSON.stringify(dashboardBody.Properties.DashboardBody);
      
      expect(bodyString).toContain('Requests');
      expect(bodyString).toContain('CacheHitRate');
      expect(bodyString).toContain('4xxErrorRate');
      expect(bodyString).toContain('5xxErrorRate');
      expect(bodyString).toContain('TotalErrorRate');
      expect(bodyString).toContain('OriginLatency');
      expect(bodyString).toContain('BytesDownloaded');
      expect(bodyString).toContain('BytesUploaded');
    });
  });
});
