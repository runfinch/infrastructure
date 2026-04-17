import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { TicketingWebhookSecretAccessStack } from '../lib/ticketing-webhook-secret-access-stack';

describe('TicketingWebhookSecretAccessStack', () => {
  test('synthesizes the way we expect', () => {
    const app = new cdk.App();
    const stack = new TicketingWebhookSecretAccessStack(app, 'TicketingWebhookSecretAccessStack', {
      terminationProtection: true,
    });

    const template = Template.fromStack(stack);
    const ssmParamRef = { 'Ref': Match.stringLikeRegexp('SsmParameterValue.*Parameter') };

    template.resourceCountIs('AWS::IAM::Role', 1);
    template.hasResource('AWS::IAM::Role', {
      Properties: {
        RoleName: 'TicketingWebhookSecretAccessRole',
        AssumeRolePolicyDocument: {
          Statement: [
            Match.objectLike({
              Effect: 'Allow',
              Principal: {
                AWS: {
                  'Fn::Join': [
                    '',
                    [
                      'arn:aws:iam::',
                      ssmParamRef,
                      ':role/ContainerRuntimeGithubTic-ContainerRuntimeGithubTic-QbYIXwNlPv62',
                    ],
                  ],
                },
              },
              Action: 'sts:AssumeRole',
            }),
          ],
        },
        Policies: [
          Match.objectLike({
            PolicyName: 'TicketingWebhookSecretAccess',
            PolicyDocument: {
              Statement: [
                Match.objectLike({
                  Sid: 'TicketingWebhookSecretAccess',
                  Effect: 'Allow',
                  Action: 'secretsmanager:GetSecretValue',
                  Resource: {
                    'Fn::Join': [
                      '',
                      [
                        'arn:aws:secretsmanager:*:',
                        { Ref: 'AWS::AccountId' },
                        ':secret:ticketing-github-webhook-secret*',
                      ],
                    ],
                  },
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
