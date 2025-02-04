#!/usr/bin/bash

# The user data script is run as root so do not use sudo command

# Log output
exec &>/var/log/setup-runner.log
echo $0

# load all variables from /etc/os-release prefixed with OS_RELEASE as to not clobber
OS_RELEASE_PREFIX="OS_RELEASE"
source <(sed -Ee "s/^([^#])/${OS_RELEASE_PREFIX}_\1/" "/etc/os-release")

# set variables to make accessing values in /etc/os-release easier
eval "OS_NAME=\"\${${OS_RELEASE_PREFIX}_NAME}\""
eval "OS_VERSION=\"\${${OS_RELEASE_PREFIX}_VERSION_ID}\""

if [ "${OS_NAME}" = "Amazon Linux" ]; then
    USERNAME="ec2-user"
    DISTRO="amazonlinux"
    BASE_PACKAGES="golang zlib-static containerd nerdctl cni-plugins iptables"
    if [ "${OS_VERSION}" = "2" ]; then
        GH_RUNNER_DEPENDENCIES="openssl krb5-libs zlib jq"
        ADDITIONAL_PACKAGES="policycoreutils-python systemd-rpm-macros ${GH_RUNNER_DEPENDENCIES}"
        NODE_VERSION="22.9.0"
        curl -OL https://d3rnber7ry90et.cloudfront.net/linux-$(uname -m)/node-v${NODE_VERSION}.tar.gz
        tar -xf node-v${NODE_VERSION}.tar.gz
        mv node-v${NODE_VERSION}/bin/* /usr/bin
    elif [ "${OS_VERSION}" = "2023" ]; then
        GH_RUNNER_DEPENDENCIES="lttng-ust openssl-libs krb5-libs zlib libicu"
        ADDITIONAL_PACKAGES="policycoreutils-python-utils ${GH_RUNNER_DEPENDENCIES}"
    fi
fi

HOMEDIR="/home/${USERNAME}"
RUNNER_DIR="${HOMEDIR}/ar"
mkdir -p "${RUNNER_DIR}" && cd "${HOMEDIR}"

# TODO: add check for non-Fedora based systems if needed
yum upgrade
yum group install -y "Development Tools"
# build dependencies for packages
# this sometimes fails on Amazon Linux 2023, so retry if necessary
for i in {1..2}; do
    yum install -y ${BASE_PACKAGES} ${ADDITIONAL_PACKAGES} && break || sleep 5
done

# start containerd
systemctl enable --now containerd

# configure download parameters based on architecture
UNAME_MACHINE="$(/usr/bin/uname -m)"
if [ "${UNAME_MACHINE}" = "aarch64" ]; then
    GH_RUNNER_ARCH="arm64"
    GH_RUNNER_DOWNLOAD_HASH="524e75dc384ba8289fcea4914eb210f10c8c4e143213cef7d28f0c84dd2d017c"
else
    GH_RUNNER_ARCH="x64"
    GH_RUNNER_DOWNLOAD_HASH="52b8f9c5abb1a47cc506185a1a20ecea19daf0d94bbf4ddde7e617e7be109b14"
fi

GH_RUNNER_FILENAME="actions-runner-linux-${GH_RUNNER_ARCH}-2.320.0.tar.gz"
GH_RUNNER_DOWNLOAD_URL="https://github.com/actions/runner/releases/download/v2.320.0/${GH_RUNNER_FILENAME}"

curl -OL "${GH_RUNNER_DOWNLOAD_URL}"
echo "${GH_RUNNER_DOWNLOAD_HASH}  ${GH_RUNNER_FILENAME}" | sha256sum -c
tar -C "${RUNNER_DIR}" -xzf "./${GH_RUNNER_FILENAME}"
chown -R "${USERNAME}:${USERNAME}" "${RUNNER_DIR}"
rm "${GH_RUNNER_FILENAME}"

# TODO: install SSM agent on non-AL hosts if needed

# Get GH API key and fetch a runner registration token
GH_KEY=$(aws secretsmanager get-secret-value --secret-id $REPO-runner-reg-key --region $REGION | jq '.SecretString' -r)
RUNNER_REG_TOKEN=$(curl -L -s \
    -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer $GH_KEY" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/runfinch/${REPO}/actions/runners/registration-token" | jq -r '.token')

if [ -z ${GH_RUNNER_DEPENDENCIES+x} ]; then
    echo "Executing installdependencies.sh because GH_RUNNER_DEPENDENCIES is not defined."
    "${RUNNER_DIR}/bin/installdependencies.sh"
fi

# Configure the runner with the registration token, launch the service
# these commands must NOT be run as root
sudo -i -u "${USERNAME}" bash <<EOF
"${RUNNER_DIR}/config.sh" --url "https://github.com/runfinch/${REPO}" --unattended --token "${RUNNER_REG_TOKEN}" --work _work --disableupdate --labels "${LABEL_ARCH},${DISTRO},${OS_VERSION},${LABEL_STAGE}"
EOF

# these commands need to be run from "runner root" as the root user
cd "${RUNNER_DIR}"
# fix SELinux perms so systemctl can execute
semanage fcontext -d "${RUNNER_DIR}/runsvc.sh"
semanage fcontext -a -t "bin_t" "${RUNNER_DIR}/runsvc.sh"
./svc.sh install "${USERNAME}"
restorecon -Fv "${RUNNER_DIR}/runsvc.sh"
./svc.sh start
