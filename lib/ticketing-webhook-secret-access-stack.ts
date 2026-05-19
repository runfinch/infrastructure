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
    const roleName = ssm.StringParameter.valueForStringParameter(this, '/finch/role/ticketing-webhook-role');

    new iam.Role(this, 'TicketingWebhookSecretAccessRole', {
      roleName: roleName,
      assumedBy: new iam.ArnPrincipal(
        `arn:aws:iam::${accountId}:role/ContainerRuntimeGithubTic-ContainerRuntimeGithubTic-QbYIXwNlPv62`
      ),
      inlinePolicies: {
        SecretsManagerAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: 'SecretsManagerAccess',
              actions: ['secretsmanager:GetSecretValue'],
              resources: [`arn:aws:secretsmanager:us-west-2:${cdk.Aws.ACCOUNT_ID}:secret:ticketing-github-webhook-secret*`],
            }),
          ],
        }),
      },
    });
  }
}
