import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

import { CloudfrontCdn } from './cloudfront_cdn';
import { applyTerminationProtectionOnStacks } from './aspects/stack-termination-protection';
import { getGitHubActionsRolePolicies } from './utils';

interface ContinuousIntegrationStackProps extends cdk.StackProps {
  rootfsEcrRepository: ecr.Repository;
}

// ContinuousIntegrationStack - AWS stack for supporting Finch's continuous integration process
export class ContinuousIntegrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, stage: string, props: ContinuousIntegrationStackProps) {
    super(scope, id, props);
    applyTerminationProtectionOnStacks([this]);

    const githubDomain = 'token.actions.githubusercontent.com';

    const ghProvider = new iam.OpenIdConnectProvider(this, 'githubProvider', {
      url: `https://${githubDomain}`,
      clientIds: ['sts.amazonaws.com']
    });

    const githubActionsRole = new iam.Role(this, 'GithubActionsRole', {
      assumedBy: new iam.WebIdentityPrincipal(ghProvider.openIdConnectProviderArn),
      roleName: 'GithubActionsRole',
      description: 'This role is used by GitHub Actions',
      maxSessionDuration: cdk.Duration.hours(1)
    });

    // Override docs: https://docs.aws.amazon.com/cdk/v2/guide/cfn_layer.html#cfn_layer_raw
    // Condition from: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html#idp_oidc_Create_GitHub
    const cfnRole = githubActionsRole.node.defaultChild as iam.CfnRole;
    cfnRole.addOverride('Properties.AssumeRolePolicyDocument.Statement.0.Condition', {
      StringLike: {
        'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        'token.actions.githubusercontent.com:sub': 'repo:runfinch/*'
      }
    });
    cfnRole.policies = getGitHubActionsRolePolicies();

    const bucketName = `finch-dependencies-${stage.toLowerCase()}-${cdk.Stack.of(this)?.account}`;

    const bucket = new s3.Bucket(this, 'Dependencies', {
      bucketName,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });
    bucket.grantReadWrite(githubActionsRole);

    const repo = props.rootfsEcrRepository;
    repo.grantPullPush(githubActionsRole);
    ecr.AuthorizationToken.grantRead(githubActionsRole)

    new CloudfrontCdn(this, 'DependenciesCloudfrontCdn', {
      bucket
    });
  }
}
