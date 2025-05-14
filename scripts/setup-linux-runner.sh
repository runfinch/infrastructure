#!/usr/bin/bash
set -ex

# The user data script is run as root so do not use sudo command

# Log output
exec &> >(tee /var/log/setup-runner.log)
echo $0

# load all variables from /etc/os-release prefixed with OS_RELEASE as to not clobber
OS_RELEASE_PREFIX="OS_RELEASE"
source <(sed -Ee "s/^([^#])/${OS_RELEASE_PREFIX}_\1/" "/etc/os-release")

# set variables to make accessing values in /etc/os-release easier
eval "OS_NAME=\"\${${OS_RELEASE_PREFIX}_NAME}\""
eval "OS_VERSION=\"\${${OS_RELEASE_PREFIX}_VERSION_ID}\""

# configure download parameters based on architecture
UNAME_MACHINE="$(/usr/bin/uname -m)"
if [ "${UNAME_MACHINE}" = "aarch64" ]; then
    GH_RUNNER_ARCH="arm64"
    NODE_DOWNLOAD_ARCH="arm64"
    GH_RUNNER_DOWNLOAD_HASH="a96b0cec7b0237ca5e4210982368c6f7d8c2ab1e5f6b2604c1ccede9cedcb143"
else
    GH_RUNNER_ARCH="x64"
    NODE_DOWNLOAD_ARCH="x86_64"
    GH_RUNNER_DOWNLOAD_HASH="b13b784808359f31bc79b08a191f5f83757852957dd8fe3dbfcc38202ccf5768"
fi

if [ "${OS_NAME}" = "Amazon Linux" ]; then
    USERNAME="ec2-user"
    DISTRO="amazonlinux"
    BASE_PACKAGES="golang zlib-static containerd nerdctl cni-plugins iptables"
    if [ "${OS_VERSION}" = "2" ]; then
        GH_RUNNER_DEPENDENCIES="openssl krb5-libs zlib jq"
        ADDITIONAL_PACKAGES="policycoreutils-python systemd-rpm-macros inotify-tools ${GH_RUNNER_DEPENDENCIES}"
        NODE_VERSION="21.2.0"
        curl -OL "https://d3rnber7ry90et.cloudfront.net/linux-${NODE_DOWNLOAD_ARCH}/node-v${NODE_VERSION}.tar.gz"
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
yum upgrade -y
yum group install -y "Development Tools"
# build dependencies for packages
# this sometimes fails on Amazon Linux 2023, so retry if necessary
for i in {1..2}; do
    yum install -y ${BASE_PACKAGES} ${ADDITIONAL_PACKAGES} && break || sleep 5
done

# start containerd
systemctl enable --now containerd

GH_RUNNER_VERSION="2.322.0"
GH_RUNNER_FILENAME="actions-runner-linux-${GH_RUNNER_ARCH}-${GH_RUNNER_VERSION}.tar.gz"
GH_RUNNER_DOWNLOAD_URL="https://github.com/actions/runner/releases/download/v${GH_RUNNER_VERSION}/${GH_RUNNER_FILENAME}"

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

# Patch runsvc.sh to use previously downloaded version of Node unless its already patched.
# This needs to be run as part of the systemd service since the runner can auto-update
# and we want to patch every time there's an update, not just the initial installation.
if [ "${OS_NAME}" = "Amazon Linux" ] && [ "${OS_VERSION}" = "2" ]; then
    RUNNER_SERVICE_NAME="actions.runner.runfinch-finch.$(hostname | cut -d. -f1).service"
    RUNNER_SERVICE_DROPIN_DIR="/etc/systemd/system/${RUNNER_SERVICE_NAME}.d"
    RUNNER_SERVICE_DROPIN_FILE="/etc/systemd/system/${RUNNER_SERVICE_NAME}.d/replace-node.conf"

    RUNNER_PATCH_SCRIPT="${HOMEDIR}/replace-node.sh"
    RUNSVC_PATH="${RUNNER_DIR}/runsvc.sh"
    ORIGINAL_NODE_PATH="./externals/\\\$nodever/bin/node"
    SYSTEM_NODE_PATH="/usr/bin/node"

    # Create a one-shot unit that will fix the node paths whenever a new node version is added.
    # This may happen if the actions runner service autoupdates, but does not restart the systemctl service.
    ONESHOT_UNIT_NAME="/etc/systemd/system/fix-actions-runner-node.service"
    WATCHER_SCRIPT="${HOMEDIR}/watcher.sh"

    cat > "${RUNNER_PATCH_SCRIPT}" << EOF
#!/usr/bin/bash
if grep -q "${ORIGINAL_NODE_PATH}" "${RUNSVC_PATH}"; then
    sed -e "s|${ORIGINAL_NODE_PATH}|${SYSTEM_NODE_PATH}|g" -i "${RUNSVC_PATH}"
fi

# replace any bundled node binary with a symlink to system node
find "${RUNNER_DIR}" -wholename "${RUNNER_DIR}/externals*/node*/bin/node" | while read line; do
    rm -rf \$line
    ln -s ${SYSTEM_NODE_PATH} \$line
done

EOF

    chmod +x "${RUNNER_PATCH_SCRIPT}"

    mkdir -p "${RUNNER_SERVICE_DROPIN_DIR}"
    cat > "${RUNNER_SERVICE_DROPIN_FILE}" << EOF
[Service]
ExecStartPre=${RUNNER_PATCH_SCRIPT}
EOF

    # Monitor the $RUNNER_DIR for all file changes. This cannot be scoped down
    # because inotifywait does not take a file glob itself, and the externals directory
    # can be suffixed with version numbers (e.g. externals.someversion, not just one externals dir).
    cat > "${WATCHER_SCRIPT}" << EOF
#!/usr/bin/bash
inotifywait -mr "${RUNNER_DIR}" -e create -e moved_to |
    while read -r directory action file; do
        path="\${directory}\${file}"
        if [[ ! "\$path" =~ .*externals.*\/node.* ]]; then
            echo 'no match for file \${path}, skipping' | systemd-cat -t "node-patcher" -p info
            continue
        fi
        if [[ "\$(readlink -e ${SYSTEM_NODE_PATH})" == "\$(readlink -e \$file)" ]]; then
            # file is already linked properly, skip
            echo "file \${path} already linked properly, skipping" | systemd-cat -t "node-patcher" -p info
            continue
        fi

        echo 'updating node path, triggered by \${path}' | systemd-cat -t "node-patcher" -p info

        "${RUNNER_PATCH_SCRIPT}"
    done
EOF

    chmod +x "${WATCHER_SCRIPT}"

    cat > "${ONESHOT_UNIT_NAME}" << EOF
[Service]
Type=oneshot
Description=GitHub Actions runner node version watcher
Exec=${WATCHER_SCRIPT}
EOF

    systemctl daemon-reload
    systemctl enable --now "${ONESHOT_UNIT_NAME}"
fi

# Configure the runner with the registration token, launch the service
# these commands must NOT be run as root
sudo -i -u "${USERNAME}" bash <<EOF
"${RUNNER_DIR}/config.sh" --url "https://github.com/runfinch/${REPO}" --unattended --token "${RUNNER_REG_TOKEN}" --work _work --labels "${LABEL_ARCH},${DISTRO},${OS_VERSION},${LABEL_STAGE}"
EOF

# these commands need to be run from "runner root" as the root user
cd "${RUNNER_DIR}"
# fix SELinux perms so systemctl can execute
semanage fcontext -a -t "bin_t" "${RUNNER_DIR}/runsvc.sh"
./svc.sh install "${USERNAME}"
./svc.sh start
