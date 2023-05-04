# The user data script is run as root so do not use sudo command
# Log output
exec &> /Users/ec2-user/setup-runner.log

echo $0

# Set up the environment
HOMEDIR="/Users/ec2-user"
RUNNER_DIR="$HOMEDIR/ar"
mkdir -p $RUNNER_DIR && cd $RUNNER_DIR
PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

# Download and setup the runner
if [ $(arch) == "arm64" ]
then
  LABEL_ARCH="arm64"
  curl -o actions-runner-osx-arm64-2.303.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.303.0/actions-runner-osx-arm64-2.303.0.tar.gz
  echo "bbbac8011066b6cec93deb2365132b082b92287baaf34b5d9539e955ffe450ff  actions-runner-osx-arm64-2.303.0.tar.gz" | shasum -a 256 -c
  # Extract the installer
  tar xzf ./actions-runner-osx-arm64-2.303.0.tar.gz
else
  LABEL_ARCH="amd64"
  curl -o actions-runner-osx-x64-2.303.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.303.0/actions-runner-osx-x64-2.303.0.tar.gz
  echo "8bd595568ceee5eb25576972bc8075b47c149b3fac7eb7873deed67944b45739  actions-runner-osx-x64-2.303.0.tar.gz" | shasum -a 256 -c
  # Extract the installer
  tar xzf ./actions-runner-osx-x64-2.303.0.tar.gz
fi

# Get GH API key and fetch a runner registration token
su ec2-user -c 'brew install jq'
GH_KEY=$(su ec2-user -c "aws secretsmanager get-secret-value --secret-id $REPO-runner-reg-key --region $REGION" | su ec2-user -c "jq '.SecretString' -r")
LABEL_VER=$(sw_vers -productVersion | cut -d '.' -f 1)
RUNNER_REG_TOKEN=$(curl -L -s \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GH_KEY"\
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/runfinch/$REPO/actions/runners/registration-token | su ec2-user -c "jq -r '.token'")

# Configure the runner with the registration token, launch the service
su - ec2-user -c "cd $RUNNER_DIR && ./config.sh --url https://github.com/runfinch/$REPO --unattended --token $RUNNER_REG_TOKEN --work _work --labels '$LABEL_ARCH,$LABEL_VER,$LABEL_STAGE'"
su - ec2-user -c "cd $RUNNER_DIR && ./svc.sh install"
PLIST_NAME="actions.runner.runfinch-$REPO.$(hostname | cut -d '.' -f 1).plist"
cp /Users/ec2-user/Library/LaunchAgents/$PLIST_NAME /Library/LaunchDaemons
/bin/launchctl load /Library/LaunchDaemons/$PLIST_NAME
