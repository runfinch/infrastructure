#!/bin/bash
# the user data script is run as root so do not use sudo command
# Download and setup the runner
HOMEDIR="/Users/ec2-user"
RUNNER_DIR="$HOMEDIR/ar"
mkdir -p $RUNNER_DIR && cd $RUNNER_DIR
curl -o actions-runner-osx-arm64-2.298.2.tar.gz -L https://github.com/actions/runner/releases/download/v2.298.2/actions-runner-osx-arm64-2.298.2.tar.gz
echo "e124418a44139b4b80a7b732cfbaee7ef5d2f10eab6bcb3fd67d5541493aa971  actions-runner-osx-arm64-2.298.2.tar.gz" | shasum -a 256 -c
# Extract the installer
tar xzf ./actions-runner-osx-arm64-2.298.2.tar.gz
