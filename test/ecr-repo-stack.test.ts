import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ECRRepositoryStack } from '../lib/ecr-repo-stack';

describe('ECRRepositoryStack', () => {
  test('synthesizes the way we expect', () => {
    const app = new cdk.App();
    const ecrRepo = new ECRRepositoryStack(app, 'ECRRepositoryStack', 'test');

    // prepare the ECRRepositoryStack template for assertions
    const template = Template.fromStack(ecrRepo);

    // assert it creates the ecr repos with properties set.
    template.resourceCountIs('AWS::ECR::Repository', 2);
    template.hasResource('AWS::ECR::Repository', {
      Properties: {
        RepositoryName: 'finch-rootfs-image-test',
        ImageTagMutability: "IMMUTABLE",
        ImageScanningConfiguration: {
          ScanOnPush: true,
        },
      },
    });

    template.hasResource('AWS::ECR::Repository', {
      Properties: {
        RepositoryName: 'finch-os-build-cache-test',
        ImageTagMutability: "MUTABLE",
        ImageScanningConfiguration: {
          ScanOnPush: false,
        },
        LifecyclePolicy: {
          LifecyclePolicyText: Match.serializedJson({
            rules: [
              {
                rulePriority: 1,
                selection: {
                  tagStatus: 'untagged',
                  countType: 'sinceImagePushed',
                  countNumber: 30,
                  countUnit: 'days',
                },
                action: { type: 'expire' },
                description: 'Expire untagged build cache layers after 30 days',
              },
            ],
          }),
        },
      },
    });

    expect(ecrRepo.terminationProtection).toBeTruthy();
  });
})
