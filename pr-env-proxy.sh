#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_NAME="$(basename "$0")"
ACTION="${1:-}"
PR_NUMBER="${2:-}"
PR_SHA="${3:-}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
CONFIG_FILE="${PR_ENV_PROXY_CONFIG:-${SCRIPT_DIR}/pr-env-proxy.env}"

log() {
    printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
}

die() {
    log "ERROR: $*"
    exit 1
}

usage() {
    cat >&2 <<USAGE
Usage:
  $SCRIPT_NAME deploy <pr-number> <commit-sha>
  $SCRIPT_NAME cleanup <pr-number>
USAGE
    exit 2
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

require_env() {
    local name="$1"
    [[ -n "${!name:-}" ]] || die "Required environment variable is missing: $name"
}

quote() {
    printf '%q' "$1"
}

load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        # shellcheck disable=SC1090
        source "$CONFIG_FILE"
    fi
}

validate_inputs() {
    [[ -n "$ACTION" ]] || usage
    [[ "$ACTION" == "deploy" || "$ACTION" == "cleanup" ]] || usage
    [[ "$PR_NUMBER" =~ ^[0-9]+$ ]] || die "PR number must be numeric"

    if [[ "$ACTION" == "deploy" ]]; then
        [[ "$PR_SHA" =~ ^[0-9a-fA-F]{40,64}$ ]] ||
            die "Commit SHA must be a 40-64 character hexadecimal value"
    fi
}

set_defaults() {
    PR_ENV_TARGET_SSH_PORT="${PR_ENV_TARGET_SSH_PORT:-22}"
}

validate_config() {
    require_env PR_ENV_TARGET_SSH_HOST
    require_env PR_ENV_TARGET_SSH_USER
    require_env PR_ENV_TARGET_SCRIPT

    [[ "$PR_ENV_TARGET_SSH_PORT" =~ ^[0-9]+$ ]] ||
        die "PR_ENV_TARGET_SSH_PORT must be numeric"
}

build_remote_command() {
    local command_prefix=""
    local remote_script
    local remote_action
    local remote_pr_number
    local remote_pr_sha

    remote_script="$(quote "$PR_ENV_TARGET_SCRIPT")"
    remote_action="$(quote "$ACTION")"
    remote_pr_number="$(quote "$PR_NUMBER")"

    if [[ "${PR_ENV_SECRET_STREAM:-}" == "1" ]]; then
        command_prefix="PR_ENV_SECRET_STREAM=1 "
    fi

    if [[ "$ACTION" == "deploy" ]]; then
        remote_pr_sha="$(quote "$PR_SHA")"
        printf '%s%s %s %s %s' \
            "$command_prefix" \
            "$remote_script" \
            "$remote_action" \
            "$remote_pr_number" \
            "$remote_pr_sha"
    else
        printf '%s%s %s %s' \
            "$command_prefix" \
            "$remote_script" \
            "$remote_action" \
            "$remote_pr_number"
    fi
}

run_proxy() {
    local target
    local remote_command
    local ssh_args

    target="${PR_ENV_TARGET_SSH_USER}@${PR_ENV_TARGET_SSH_HOST}"
    remote_command="$(build_remote_command)"
    ssh_args=(
        -T
        -o BatchMode=yes
        -p "$PR_ENV_TARGET_SSH_PORT"
    )

    if [[ -n "${PR_ENV_TARGET_SSH_KEY:-}" ]]; then
        ssh_args+=(-i "$PR_ENV_TARGET_SSH_KEY")
    fi

    if [[ -n "${PR_ENV_TARGET_SSH_KNOWN_HOSTS_FILE:-}" ]]; then
        ssh_args+=(
            -o "UserKnownHostsFile=${PR_ENV_TARGET_SSH_KNOWN_HOSTS_FILE}"
            -o StrictHostKeyChecking=yes
        )
    fi

    log "Forwarding ${ACTION} for PR ${PR_NUMBER} to ${target}"
    exec ssh "${ssh_args[@]}" "$target" "$remote_command"
}

main() {
    validate_inputs
    require_command ssh
    load_config
    set_defaults
    validate_config
    run_proxy
}

main "$@"
