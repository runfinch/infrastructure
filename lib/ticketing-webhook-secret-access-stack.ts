import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { applyTerminationProtectionOnStacks } from './aspects/stack-termination-protection';

export class TicketingWebhookSecretAccessStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    applyTerminationProtectionOnStacks([this]);

    const accountId = ssm.StringParameter.valueForStringParameter(this, '/finch/account/ticketing-webhook');

    new iam.Role(this, 'TicketingWebhookSecretAccessRole', {
      roleName: 'TicketingWebhookSecretAccessRole',
      assumedBy: new iam.ArnPrincipal(
        `arn:aws:iam::${accountId}:role/ContainerRuntimeGithubTic-ContainerRuntimeGithubTic-QbYIXwNlPv62`
      ),
      inlinePolicies: {
        TicketingWebhookSecretAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: 'TicketingWebhookSecretAccess',
              actions: ['secretsmanager:GetSecretValue'],
              resources: [`arn:aws:secretsmanager:*:${cdk.Aws.ACCOUNT_ID}:secret:ticketing-github-webhook-secret*`],
            }),
          ],
        }),
      },
    });
  }
}
