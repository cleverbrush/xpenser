#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
RELEASE_DIR=""

log() {
    printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
}

die() {
    log "ERROR: $*"
    return 1
}

compose() {
    docker compose --project-name "$PROD_DEPLOY_PROJECT" \
        --project-directory "$SOURCE_DIR" \
        --env-file "$PROD_DEPLOY_ENV_FILE" \
        --file "${SOURCE_DIR}/docker-compose.prod.yml" \
        --file "${RELEASE_DIR}/images.compose.json" "$@"
}

failed() {
    local status=$?
    trap - ERR
    log "Deployment failed (exit ${status}); recovery is manual."
    if [[ -n "$RELEASE_DIR" ]]; then
        compose ps --all >"${RELEASE_DIR}/containers.log" 2>&1 || true
        compose logs --no-color --tail=200 api web telegram-bot \
            >"${RELEASE_DIR}/services.log" 2>&1 || true
        printf '%s\n' "$status" >"${RELEASE_DIR}/failed"
        log "Release, previous container images, and diagnostics: ${RELEASE_DIR}"
    fi
    exit "$status"
}
trap failed ERR

snapshot_containers() {
    local service container info result='{}'
    for service in api web telegram-bot; do
        container="$(compose ps --all --quiet "$service")"
        [[ -n "$container" && "$container" != *$'\n'* ]] ||
            die "Expected one existing ${service} container"
        info="$(docker inspect --format \
            '{"image":{{json .Config.Image}},"image_id":{{json .Image}},"compose_files":{{json (index .Config.Labels "com.docker.compose.project.config_files")}}}' \
            "$container")"
        result="$(jq --arg service "$service" --argjson info "$info" \
            '. + {($service): $info}' <<<"$result")"
    done
    printf '%s\n' "$result"
}

main() {
    [[ $# -eq 1 && "$1" =~ ^[0-9a-f]{40}$ ]] ||
        die 'Usage: prod-deploy.sh <40-character-commit-sha>'
    local sha="$1"
    # Never load configuration or secrets from the requested application revision.
    # shellcheck source=/dev/null
    source "${PROD_DEPLOY_CONFIG:-${SCRIPT_DIR}/prod-deploy.env}"
    : "${PROD_DEPLOY_PROJECT:?required}"
    : "${PROD_DEPLOY_BRANCH:?required}"
    : "${PROD_DEPLOY_REPOSITORY_URL:?required}"
    : "${PROD_DEPLOY_ENV_FILE:?required}"
    : "${PROD_DEPLOY_URL:?required}"
    [[ "$PROD_DEPLOY_PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die 'Invalid project'
    [[ "$PROD_DEPLOY_ENV_FILE" == /* && -r "$PROD_DEPLOY_ENV_FILE" ]] ||
        die 'Production env file must be an existing absolute path'
    [[ "$PROD_DEPLOY_URL" =~ ^https://[a-zA-Z0-9.-]+(:[0-9]+)?/?$ ]] ||
        die 'Production URL must be an HTTPS origin'
    PROD_DEPLOY_URL="${PROD_DEPLOY_URL%/}"
    local state_dir="${PROD_DEPLOY_STATE_DIR:-/var/lib/prod-deploy/${PROD_DEPLOY_PROJECT}}"
    local build_lock="${PROD_DEPLOY_BUILD_LOCK:-/var/lock/app-image-build.lock}"
    local health_timeout="${PROD_DEPLOY_HEALTH_TIMEOUT:-300}"
    [[ "$state_dir" == /* && "$build_lock" == /* ]] || die 'State and lock paths must be absolute'
    [[ "$health_timeout" =~ ^[1-9][0-9]*$ ]] || die 'Health timeout must be positive'
    local command
    for command in git docker jq curl flock tar; do
        command -v "$command" >/dev/null || die "Missing command: ${command}"
    done
    git check-ref-format --branch "$PROD_DEPLOY_BRANCH" >/dev/null

    mkdir -p "${state_dir}/releases"
    exec 9>"${state_dir}/deploy.lock"
    flock --exclusive 9
    local repository="${state_dir}/repository.git"
    local branch_ref="refs/remotes/origin/${PROD_DEPLOY_BRANCH}"
    if [[ ! -d "$repository" ]]; then
        git init --bare "$repository" >/dev/null
        git --git-dir="$repository" remote add origin "$PROD_DEPLOY_REPOSITORY_URL"
    fi
    git --git-dir="$repository" fetch --no-tags origin \
        "+refs/heads/${PROD_DEPLOY_BRANCH}:${branch_ref}"
    git --git-dir="$repository" cat-file -e "${sha}^{commit}"
    git --git-dir="$repository" merge-base --is-ancestor "$sha" "$branch_ref" ||
        die 'Requested commit is outside the production branch'

    # An admitted Actions run may finish after the branch advances. Never allow
    # an older retry to overwrite a newer successful or partially applied release.
    local prior_sha state_file
    for state_file in "${state_dir}/current.json" "${state_dir}/last-attempt.json"; do
        if [[ -f "$state_file" ]]; then
            prior_sha="$(jq -er '.sha' "$state_file")"
            [[ "$prior_sha" =~ ^[0-9a-f]{40}$ ]] || die 'Invalid recorded release SHA'
            git --git-dir="$repository" merge-base --is-ancestor "$prior_sha" "$sha" ||
                die 'Refusing to overwrite a newer or divergent release'
        fi
    done

    # Production is already provisioned. Application deployment never creates,
    # recreates, stops, or migrates the PostgreSQL container itself.
    local postgres postgres_after
    postgres="$(docker ps --quiet \
        --filter "label=com.docker.compose.project=${PROD_DEPLOY_PROJECT}" \
        --filter 'label=com.docker.compose.service=postgres')"
    [[ -n "$postgres" && "$postgres" != *$'\n'* ]] || die 'Expected one production PostgreSQL container'
    [[ "$(docker inspect --format '{{.State.Health.Status}}' "$postgres")" == healthy ]] ||
        die 'Production PostgreSQL is not healthy'

    RELEASE_DIR="$(mktemp -d "${state_dir}/releases/${sha}.XXXXXX")"
    SOURCE_DIR="${RELEASE_DIR}/source"
    mkdir "$SOURCE_DIR"
    git --git-dir="$repository" archive "$sha" | tar -x -C "$SOURCE_DIR"
    local version
    version="$(jq -er '.version | strings | select(test("^[0-9A-Za-z.+_-]+$"))' "${SOURCE_DIR}/package.json")"
    jq -n --arg project "$PROD_DEPLOY_PROJECT" --arg sha "$sha" \
        --arg version "$version" --arg source "$PROD_DEPLOY_REPOSITORY_URL" '
        {services: (["api", "web", "telegram-bot"] | map({key: ., value: {
            image: ($project + "-" + . + ":" + $sha),
            build: {labels: {
                "org.opencontainers.image.revision": $sha,
                "org.opencontainers.image.version": $version,
                "org.opencontainers.image.source": $source
            }},
            environment: {npm_package_version: $version}
        }}) | from_entries)}' >"${RELEASE_DIR}/images.compose.json"
    compose config --quiet
    snapshot_containers >"${RELEASE_DIR}/previous-containers.json"

    log "Building ${PROD_DEPLOY_PROJECT} ${sha}; waiting for the shared preview/production build lock"
    (
        flock --exclusive 8
        compose --parallel 1 build api web telegram-bot
    ) 8>"$build_lock"

    jq -n --arg sha "$sha" --arg version "$version" --arg release "$RELEASE_DIR" \
        --arg date "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
        --arg env_file "$PROD_DEPLOY_ENV_FILE" \
        '{sha: $sha, version: $version, release_dir: $release,
          attempted_at: $date, env_file: $env_file,
          compose_files: [($release + "/source/docker-compose.prod.yml"), ($release + "/images.compose.json")],
          project_directory: ($release + "/source")}' >"${state_dir}/last-attempt.json.tmp"
    mv "${state_dir}/last-attempt.json.tmp" "${state_dir}/last-attempt.json"

    log 'Starting API and waiting for startup migrations and health'
    compose up -d --no-build --no-deps --wait --wait-timeout "$health_timeout" api
    log 'Starting web and Telegram worker'
    compose up -d --no-build --no-deps --wait --wait-timeout "$health_timeout" web telegram-bot
    local path
    for path in / /api/health; do
        curl --fail --silent --show-error --location \
            --connect-timeout 10 --max-time 20 \
            --retry 12 --retry-delay 5 --retry-all-errors \
            --output /dev/null "${PROD_DEPLOY_URL}${path}"
    done
    [[ "$(compose ps --status running --services telegram-bot)" == telegram-bot ]] ||
        die 'Telegram worker is not running'
    postgres_after="$(docker ps --quiet \
        --filter "label=com.docker.compose.project=${PROD_DEPLOY_PROJECT}" \
        --filter 'label=com.docker.compose.service=postgres')"
    [[ "$postgres_after" == "$postgres" ]] || die 'PostgreSQL container changed during deployment'
    snapshot_containers >"${RELEASE_DIR}/containers.json"
    if [[ -f "${state_dir}/current.json" ]]; then
        cp "${state_dir}/current.json" "${state_dir}/previous.json.tmp"
        mv "${state_dir}/previous.json.tmp" "${state_dir}/previous.json"
    fi
    jq --arg date "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
        '. + {succeeded_at: $date}' "${state_dir}/last-attempt.json" >"${state_dir}/current.json.tmp"
    mv "${state_dir}/current.json.tmp" "${state_dir}/current.json"
    log "Production ready: ${PROD_DEPLOY_URL} (${sha})"
}

main "$@"
