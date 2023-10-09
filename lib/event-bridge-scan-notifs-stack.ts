import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import path from 'path';

export class EventBridgeScanNotifsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, stage: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const topic = new sns.Topic(this, 'ECR Image Inspector Findings');

    // Let's not expose this on GitHub, will only be visible in AWS logs Finch team owns, which is low risk.
    // Secret has to be created only in Prod account.
    // unsafeUnwrap is used because SNS does not have any construct that accepts a SecretValue property.
    const securityEmail = cdk.SecretValue.secretsManager('security-notifications-email').unsafeUnwrap()
    topic.addSubscription(new subscriptions.EmailSubscription(securityEmail.toString()));

    const notificationFn = new lambda.Function(this, 'SendECRImageInspectorFindings', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'main.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'image-scanning-notifications-lambda-handler')),
      environment: {'SNS_ARN': topic.topicArn,},
    });

    const snsTopicPolicy = new iam.PolicyStatement({
      actions: ['sns:publish'],
      resources: ['*'],
    });

    notificationFn.addToRolePolicy(snsTopicPolicy);
    
    // Only publish CRITICAL and HIGH findings (more than 7.0 CVE score) that are ACTIVE
    // https://docs.aws.amazon.com/inspector/latest/user/findings-understanding-severity.html
    const rule = new events.Rule(this, 'rule', {
        eventPattern: {
          source: ['aws.inspector2'],
          detail: {
            severity: ['HIGH', 'CRITICAL'], 
            status: events.Match.exactString('ACTIVE')
          },
          detailType: events.Match.exactString('Inspector2 Finding'),
        },
      });

    rule.addTarget(new targets.LambdaFunction(notificationFn))
  }
}