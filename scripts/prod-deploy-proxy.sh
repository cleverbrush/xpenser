#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
[[ $# -eq 1 && "$1" =~ ^[0-9a-f]{40}$ ]] || {
    printf 'Usage: prod-deploy-proxy.sh <40-character-commit-sha>\n' >&2
    exit 2
}
SHA="$1"
# This configuration is installed by the operator, outside application checkouts.
# shellcheck source=/dev/null
source "${PROD_DEPLOY_CONFIG:-${SCRIPT_DIR}/prod-deploy.env}"

: "${PROD_DEPLOY_TARGET_HOST:?required}"
: "${PROD_DEPLOY_TARGET_USER:?required}"
: "${PROD_DEPLOY_TARGET_KEY:?required}"
: "${PROD_DEPLOY_TARGET_KNOWN_HOSTS:?required}"
PORT="${PROD_DEPLOY_TARGET_PORT:-22}"
[[ "$PORT" =~ ^[0-9]+$ ]] || exit 2

exec ssh -T \
    -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
    -o ConnectTimeout=15 -o ServerAliveInterval=30 -o ServerAliveCountMax=6 \
    -o "UserKnownHostsFile=${PROD_DEPLOY_TARGET_KNOWN_HOSTS}" \
    -i "$PROD_DEPLOY_TARGET_KEY" -p "$PORT" \
    "${PROD_DEPLOY_TARGET_USER}@${PROD_DEPLOY_TARGET_HOST}" "deploy ${SHA}"
