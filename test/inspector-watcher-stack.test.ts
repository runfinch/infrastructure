import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { InspectorWatcherStack } from '../lib/inspector-watcher-stack';

describe('InspectorWatcherStack', () => {
  test('synthesizes the way we expect', () => {
    const app = new cdk.App();
    const stack = new InspectorWatcherStack(app, 'InspectorWatcherStack', {
      terminationProtection: true,
    });

    const template = Template.fromStack(stack);
    const ssmParamRef = { 'Ref': Match.stringLikeRegexp('SsmParameterValue.*Parameter') };

    template.resourceCountIs('AWS::IAM::Role', 1);
    template.hasResource('AWS::IAM::Role', {
      Properties: {
        RoleName: 'InspectorWatcherReadOnly',
        AssumeRolePolicyDocument: {
          Statement: [
            Match.objectLike({
              Effect: 'Allow',
              Principal: {
                AWS: {
                  'Fn::Join': ['', ['arn:aws:iam::', ssmParamRef, ':root']],
                },
              },
              Action: 'sts:AssumeRole',
              Condition: {
                ArnLike: {
                  'aws:PrincipalArn': {
                    'Fn::Join': ['', ['arn:aws:iam::', ssmParamRef, ':role/InspectorWatcherStack*']],
                  },
                },
              },
            }),
          ],
        },
        Policies: [
          Match.objectLike({
            PolicyName: 'InspectorWatcherReadOnly',
            PolicyDocument: {
              Statement: [
                Match.objectLike({
                  Sid: 'InspectorWatcherReadOnly',
                  Effect: 'Allow',
                  Action: [
                    'ecr:DescribeImageScanFindings',
                    'ecr:DescribeRegistry',
                    'ecr:BatchGetImage',
                    'ecr:DescribeImages',
                    'ecr:DescribeRepositories',
                    'ecr:ListTagsForResource',
                    'ecr:BatchGetRepositoryScanningConfiguration',
                    'ecr:ListImages',
                    'ecr:GetRegistryScanningConfiguration',
                    'inspector2:BatchGet*',
                    'inspector2:List*',
                    'inspector2:Describe*',
                    'inspector2:Get*',
                    'inspector2:Search*',
                  ],
                  Resource: '*',
                }),
              ],
            },
          }),
        ],
      },
    });

    expect(stack.terminationProtection).toBeTruthy();
  });
});
