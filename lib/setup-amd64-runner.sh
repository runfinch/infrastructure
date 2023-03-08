#!/bin/bash
# the user data script is run as root so do not use sudo command
# Download and setup the runner
HOMEDIR="/Users/ec2-user"
RUNNER_DIR="$HOMEDIR/ar"
mkdir -p $RUNNER_DIR && cd $RUNNER_DIR
curl -o actions-runner-osx-x64-2.298.2.tar.gz -L https://github.com/actions/runner/releases/download/v2.298.2/actions-runner-osx-x64-2.298.2.tar.gz
echo "0fb116f0d16ac75bcafa68c8db7c816f36688d3674266fe65139eefec3a9eb04  actions-runner-osx-x64-2.298.2.tar.gz" | shasum -a 256 -c
# Extract the installer
tar xzf ./actions-runner-osx-x64-2.298.2.tar.gz


