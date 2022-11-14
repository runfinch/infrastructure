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

The stack `MacRunnerStack` is used to provision EC2 Mac instance which acts as a self-hosted GitHub actions runner, as well as the dedicated physical/metal host which the EC2 instance uses. <br>

The EC2 user data script runs when the instance is launched for the first time and it can be customized for each runner.

This script downloads and installs [GitHub actions runner application](https://github.com/actions/runner) on the our self-hosted runner, which is used to connect our runner with the GitHub actions. It then writes the `cleanup.sh` and `.env` files into the runner application directory. The `cleanup.sh` script deletes the old working directory of the previous job.<br>

#### Connect runners to Github Actions

After the self-hosted runner stack is deployed successfully, run the ssh command to log into the runner.<br>
`ssh -i runner-key.pem -o IdentitiesOnly=yes ec2-user@xx.xxx.xxx.xxx`<br>
Connect the runner to the GitHub actions in your repository. Go the the GitHub repo, then navigate to Settings > Actions > Runners > New self-hosted runner, and run the commands in the “Configure” section to connect the runner and start.<br>
To connect the ec2 runner without using an ssh key, please use Session Manager. Go to the AWS EC2 console, select the instance and click Connect > Session Manager.<br>

#### Starting the runner as a service

Currently, due to an [ongoing issue](https://github.com/actions/runner/issues/1056), the service cannot be run using the normal method. As a workaround, install the service and start `runsvc.sh` in the background. <br>

```bash
sudo su -- ec2-user ./svc.sh install
sudo su -- ec2-user ./runsvc.sh start &
```

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
