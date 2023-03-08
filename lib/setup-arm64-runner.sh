#!/bin/bash
# the user data script is run as root so do not use sudo command
# Download and setup the runner
HOMEDIR="/Users/ec2-user"
RUNNER_DIR="$HOMEDIR/ar"
mkdir -p $RUNNER_DIR && cd $RUNNER_DIR
curl -o actions-runner-osx-arm64-2.302.1.tar.gz -L https://github.com/actions/runner/releases/download/v2.302.1/actions-runner-osx-arm64-2.302.1.tar.gz
echo "f78f4db37bb7ba80e6123cec0e3984d1f2bb3f8f3a16db679c42ef830e0981d3  actions-runner-osx-arm64-2.302.1.tar.gz" | shasum -a 256 -c
# Extract the installer
tar xzf ./actions-runner-osx-arm64-2.302.1.tar.gz