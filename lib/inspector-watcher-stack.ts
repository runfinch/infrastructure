import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { applyTerminationProtectionOnStacks } from './aspects/stack-termination-protection';

export class InspectorWatcherStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    applyTerminationProtectionOnStacks([this]);

    const accountId = ssm.StringParameter.valueForStringParameter(this, '/finch/account/inspector-watcher');

    new iam.Role(this, 'InspectorWatcherReadonly', {
      roleName: 'InspectorWatcherReadonly',
      assumedBy: new iam.ArnPrincipal(`arn:aws:iam::${accountId}:root`).withConditions({
        ArnLike: {
          'aws:PrincipalArn': `arn:aws:iam::${accountId}:role/InspectorWatcherStack*`,
        },
      }),
      inlinePolicies: {
        InspectorWatcherReadOnly: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: 'InspectorWatcherReadOnly',
              actions: [
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
              resources: ['*'],
            }),
          ],
        }),
      },
    });
  }
}
