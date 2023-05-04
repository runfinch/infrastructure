# AWS CDK repo for Finch

## Prerequisites

- Install [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and [configured to the right account and user](https://cdkworkshop.com/15-prerequisites/200-account.html)
- Install Node.js (>= 10.13.0, except for versions 13.0.0 - 13.6.0)
- Install AWS CDK Toolkit with `npm install -g aws-cdk` <br>

## Deployment Steps

**_Step 1:_** Clone the infrastructure repo and open a terminal.<br>
**_Step 2:_** Before the deployment, check whether the key pair `runner-key.pem` exists in your AWS EC2 console. If not, set up a ssh key pair `runner-key.pem` for ssh to the ec2 instance. Go to AWS console > EC2, in the left tab “Network & Security” > “Key Pairs”, click “Create key pair” with name runner-key.pem.<br>
Or create the key pair with the AWS CLI command below.<br>
`aws ec2 create-key-pair --key-name runner-key --output text > runner-key.pem`

**_Step 3:_** For the first time deployment to an environment, run `cdk bootstrap aws://PIPELINE-ACCOUNT-NUMBER/REGION` to bootstrap the pipeline account and `cdk bootstrap --cloudformation-execution-policies 'arn:aws:iam::aws:policy/AdministratorAccess' --trust PIPELINE-ACCOUNT-NUMBER aws://STAGE-ACCOUNT-NUMBER/REGION` to bootstrap the beta/prod accounts. Then run `cdk deploy` with the pipeline account credentials set up to deploy the pipeline stack, and all the application stacks will be deployed by the pipeline for each commit.<br>

### Self-hosted Runners (Mac Arm64 and Mac Amd64)

The stack `ASGRunnerStack` is used to provision EC2 Mac instances through an autoscaling group. The runner configurations can be edited in `config/runner-config.json`. <br>
When the runners are initialized, a user data script (`scripts/setup-runner.sh`) runs to setup the instance. This script downloads and installs [GitHub actions runner application](https://github.com/actions/runner) on the our self-hosted runner, which is used to connect our runner with the GitHub actions. Then the script connects the instance with our GitHub repos, starting the runner service.<br>

#### Connect to the runners for troubleshooting

After the runner is linked to the GitHub repo, you can access a runner to trouble shoot it by noting down the name of the runner (usually `ip172-31-xx-xxx`), access the AWS account that hosts the instance, and find the instance with the private IP address matching the name above. Connect to the runner either by using an SSH service with the key saved in the Secret Manager, or use Session Manager in EC2. Go to the AWS EC2 console, select the instance and click Connect > Session Manager.<br>

### S3 Bucket and Cloudfront Distributions

The S3 buckets are used for storing project artifacts and dependencies that should be publicly accessible. To make the content delivery more effective and secure, we also set up CloudFront to work with the S3 buckets.<br>
The construct `CloudfrontCdn` creates a new CloudFront distribution in front of an existing S3 bucket and adds an OAI to it which makes the content in the bucket can be read by the CloudFront distribution. Users can then access the bucket objects through the CloudFront domain instead of the S3 bucket URL, and benefit from CloudFront's features, like caching. <br>

- Get the distribution domain from the AWS console.
- Enter the CloudFront URL, concatenated with the path to a file in your browser to download a file.
  For example, `*.cloudfront.net/path/to/file`.

## Unit and Integration Tests

The unit tests and integration tests are both executed by the pipeline post-deployment steps in `Beta` stage. Or you can run the tests with the command below.<br>

```
npm run test
npm run integration
```

Format your code with the command `npm run prettier-format`. <br>

## Host Licensing

When using Auto Scaling Group with macOS instances on EC2, a host license has to be created in AWS License Manager. Create a self-managed license named `MacHostLicense`, set the license type to `sockets`, and save the arn to the `runner-config.json` file.


## Access Tokens

Overall, 3 access tokens are required - one for the pipeline to access the runfinch/infrastructure code and update when there is a code update, and two for runfinch/finch and runfinch/finch-core to provide the github runner keys for automatically creating and registering the runners