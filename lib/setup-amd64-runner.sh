#!/bin/bash
# the user data script is run as root so do not use sudo command
# Download and setup the runner
HOMEDIR="/Users/ec2-user"
RUNNER_DIR="$HOMEDIR/ar"
mkdir -p $RUNNER_DIR && cd $RUNNER_DIR
curl -o actions-runner-osx-x64-2.302.1.tar.gz -L https://github.com/actions/runner/releases/download/v2.302.1/actions-runner-osx-x64-2.302.1.tar.gz
echo "cc061fc4ae62afcbfab1e18f1b2a7fc283295ca3459345f31a719d36480a8361  actions-runner-osx-x64-2.302.1.tar.gz" | shasum -a 256 -c
# Extract the installer
tar xzf ./actions-runner-osx-x64-2.302.1.tar.gz