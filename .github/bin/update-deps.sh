#!/bin/bash
set -euxo pipefail

# update-deps.sh checks for the latest versions of GitHub Actions runners using the GitHub CLI
# and updates scripts/setup-runner.sh with this version and shas of releases.
# GitHub CLI is preinstalled on all GitHub-hosted runners
# https://docs.github.com/en/actions/using-workflows/using-github-cli-in-workflows

latestVersion=$(gh release list --repo actions/runner --limit 10 --exclude-drafts --exclude-pre-releases | grep Latest | cut -f 1)

RUNNER_VERSION_PATTERN="[0-9]+\.[0-9]+\.[0-9]+"
X86_64_SHA_PATTERN="^.*<\!-- BEGIN SHA osx-x64 -->\([a-z0-9]\{64\}\)<\!-- END SHA osx-x64 -->"
AARCH64_SHA_PATTERN="^.*<\!-- BEGIN SHA osx-arm64 -->\([a-z0-9]\{64\}\)<\!-- END SHA osx-arm64 -->"

# find shas from release notes for the version
X86_64_SHA=$(sed -n 's/'"${X86_64_SHA_PATTERN}"'/\1/p' <(GH_PAGER= gh release view --repo actions/runner ${latestVersion}))
AARCH64_SHA=$(sed -n 's/'"${AARCH64_SHA_PATTERN}"'/\1/p' <(GH_PAGER= gh release view --repo actions/runner ${latestVersion}))

# replace versions and shas in setup-runner.sh
latestVersion=${latestVersion:1} # strip v from version
sed -E  -i.bak  's/'${RUNNER_VERSION_PATTERN}'/'${latestVersion}'/g' scripts/setup-runner.sh
sed -i.bak  's/[a-z0-9]\{64\}\(  actions-runner-osx-x64\)/'${X86_64_SHA}'\1/' scripts/setup-runner.sh
sed -i.bak  's/[a-z0-9]\{64\}\(  actions-runner-osx-arm64\)/'${AARCH64_SHA}'\1/' scripts/setup-runner.sh