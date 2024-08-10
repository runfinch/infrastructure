import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ECRRepositoryStack } from '../lib/ecr-repo-stack';

describe('ECRRepositoryStack', () => {
  test('synthesizes the way we expect', () => {
    const app = new cdk.App();
    const ecrRepo = new ECRRepositoryStack(app, 'ECRRepositoryStack', 'test');

    // prepare the ECRRepositoryStack template for assertions
    const template = Template.fromStack(ecrRepo);

    // assert it creates the ecr repo with properties set.
    template.resourceCountIs('AWS::ECR::Repository', 1);
    template.hasResource('AWS::ECR::Repository', {
      Properties: {
        RepositoryName: Match.anyValue(),
        ImageTagMutability: 'IMMUTABLE',
        ImageScanningConfiguration: {
          ScanOnPush: true
        }
      }
    });

    expect(ecrRepo.terminationProtection).toBeTruthy();
  });
});
