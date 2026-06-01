#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_NAME="$(basename "$0")"
ACTION="${1:-}"
PR_NUMBER="${2:-}"
PR_SHA="${3:-}"

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

base64_decode() {
    if base64 --help 2>/dev/null | grep -q -- '--decode'; then
        base64 --decode
    else
        base64 -d
    fi
}

read_secret_line() {
    local target="$1"
    local encoded=""

    IFS= read -r encoded || encoded=""
    printf -v "$target" '%s' "$(printf '%s' "$encoded" | base64_decode)"
}

load_secret_stream() {
    if [[ "${PR_ENV_SECRET_STREAM:-}" != "1" ]]; then
        return
    fi

    read_secret_line PASSPORT_SERVICE_KEY
    read_secret_line PR_ENV_DOMAIN_SUFFIX
    read_secret_line PASSPORT_BASE_URL
    read_secret_line PROD_COMPOSE_PROJECT
    read_secret_line PR_ENV_ROOT
    read_secret_line PR_ENV_STATE_DIR
    read_secret_line PR_ENV_PORT_BASE
    read_secret_line GIT_REPOSITORY_URL
    read_secret_line PR_ENV_OTEL_EXPORTER_OTLP_ENDPOINT
    read_secret_line PR_ENV_PROJECT_NAME
    read_secret_line PR_ENV_DOMAIN_PROJECT
    read_secret_line PASSPORT_PROJECT
    read_secret_line POSTGRES_DB
    read_secret_line POSTGRES_USER
    read_secret_line CLOUDFLARE_API_TOKEN
    read_secret_line CLOUDFLARE_ZONE_ID
    read_secret_line PR_ENV_DNS_RECORD_TYPE
    read_secret_line PR_ENV_DNS_RECORD_CONTENT
    read_secret_line PR_ENV_DNS_RECORD_PROXIED
    read_secret_line PR_ENV_DNS_RECORD_TTL
    if [[ "$ACTION" == "deploy" ]]; then
        read_secret_line OPENAI_API_KEY
        read_secret_line OPENAI_REPORT_MODEL
        read_secret_line RESEND_API_KEY
        read_secret_line EMAIL_FROM
        read_secret_line EMAIL_REPORTS_ENABLED
        read_secret_line EMAIL_REPORTS_SCHEDULER_ENABLED
        read_secret_line EMAIL_REPORTS_TEST_SECRET
    fi

    export PASSPORT_SERVICE_KEY
    export PR_ENV_DOMAIN_SUFFIX
    export PASSPORT_BASE_URL
    export PROD_COMPOSE_PROJECT
    export PR_ENV_ROOT
    export PR_ENV_STATE_DIR
    export PR_ENV_PORT_BASE
    export GIT_REPOSITORY_URL
    export PR_ENV_OTEL_EXPORTER_OTLP_ENDPOINT
    export PR_ENV_PROJECT_NAME
    export PR_ENV_DOMAIN_PROJECT
    export PASSPORT_PROJECT
    export POSTGRES_DB
    export POSTGRES_USER
    export CLOUDFLARE_API_TOKEN
    export CLOUDFLARE_ZONE_ID
    export PR_ENV_DNS_RECORD_TYPE
    export PR_ENV_DNS_RECORD_CONTENT
    export PR_ENV_DNS_RECORD_PROXIED
    export PR_ENV_DNS_RECORD_TTL
    export OPENAI_API_KEY
    export OPENAI_REPORT_MODEL
    export RESEND_API_KEY
    export EMAIL_FROM
    export EMAIL_REPORTS_ENABLED
    export EMAIL_REPORTS_SCHEDULER_ENABLED
    export EMAIL_REPORTS_TEST_SECRET
}

require_env() {
    local name="$1"
    [[ -n "${!name:-}" ]] || die "Required environment variable is missing: $name"
}

run_sudo() {
    if [[ "$(id -u)" == "0" ]]; then
        "$@"
    else
        sudo "$@"
    fi
}

ensure_writable_dir() {
    local dir="$1"

    if mkdir -p "$dir" 2>/dev/null; then
        return
    fi

    run_sudo mkdir -p "$dir"
    run_sudo chown "$(id -u):$(id -g)" "$dir"
}

quote_env() {
    printf '%q' "$1"
}

write_shell_env() {
    local file="$1"
    shift

    : >"$file"
    while (($# > 0)); do
        local key="$1"
        local value="$2"
        shift 2
        printf '%s=%s\n' "$key" "$(quote_env "$value")" >>"$file"
    done
}

write_compose_env() {
    local file="$1"

    cat >"$file" <<ENV
NODE_ENV=production
APP_URL=https://${DOMAIN}
PUBLIC_API_BASE_URL=https://${DOMAIN}/external-api
WEB_PORT=${WEB_PORT}
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=1209600
WEB_API_SERVICE_SECRET=${WEB_API_SERVICE_SECRET}
NEXTAUTH_URL=https://${DOMAIN}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
AUTH_SECRET=${NEXTAUTH_SECRET}
PASSPORT_BASE_URL=${PASSPORT_BASE_URL}
PASSPORT_PROJECT=${PASSPORT_PROJECT}
PASSPORT_ENVIRONMENT=${PASSPORT_ENVIRONMENT}
PASSPORT_PUBLIC_KEY=
TELEGRAM_BOT_SERVICE_SECRET=${TELEGRAM_BOT_SERVICE_SECRET}
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_LINK_TOKEN_TTL_SECONDS=600
TELEGRAM_JWT_EXPIRES_IN=300
FRANKFURTER_BASE_URL=https://api.frankfurter.dev/v2
OPENAI_API_KEY=${OPENAI_API_KEY:-}
OPENAI_REPORT_MODEL=${OPENAI_REPORT_MODEL:-gpt-5-mini}
RESEND_API_KEY=${RESEND_API_KEY:-}
EMAIL_FROM=${EMAIL_FROM:-Xpenser <reports@xpenser.app>}
EMAIL_REPORTS_ENABLED=${EMAIL_REPORTS_ENABLED:-0}
EMAIL_REPORTS_SCHEDULER_ENABLED=${EMAIL_REPORTS_SCHEDULER_ENABLED:-0}
EMAIL_REPORTS_TEST_SECRET=${EMAIL_REPORTS_TEST_SECRET:-}
EMAIL_REPORTS_DELIVERY_HOUR_LOCAL=8
EMAIL_REPORTS_MAX_ATTEMPTS=3
OTEL_API_SERVICE_NAME=${PR_ENV_PROJECT_NAME}-api-${PASSPORT_ENVIRONMENT}
OTEL_WEB_SERVICE_NAME=${PR_ENV_PROJECT_NAME}-web-${PASSPORT_ENVIRONMENT}
OTEL_TELEGRAM_SERVICE_NAME=${PR_ENV_PROJECT_NAME}-telegram-bot-${PASSPORT_ENVIRONMENT}
LOG_LEVEL=information
ENV

    if [[ -n "${PR_ENV_OTEL_EXPORTER_OTLP_ENDPOINT:-}" ]]; then
        printf 'OTEL_EXPORTER_OTLP_ENDPOINT=%s\n' \
            "$PR_ENV_OTEL_EXPORTER_OTLP_ENDPOINT" >>"$file"
    fi
}

random_secret() {
    openssl rand -hex 32
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

validate_config() {
    [[ "$PR_ENV_PORT_BASE" =~ ^[0-9]+$ ]] ||
        die "PR_ENV_PORT_BASE must be numeric"
    [[ "$PR_ENV_DNS_RECORD_TTL" =~ ^[0-9]+$ ]] ||
        die "PR_ENV_DNS_RECORD_TTL must be numeric"
    [[ "$PR_ENV_DNS_RECORD_PROXIED" == "true" ||
        "$PR_ENV_DNS_RECORD_PROXIED" == "false" ]] ||
        die "PR_ENV_DNS_RECORD_PROXIED must be true or false"
    [[ "$PR_ENV_DNS_RECORD_TYPE" == "A" ||
        "$PR_ENV_DNS_RECORD_TYPE" == "AAAA" ||
        "$PR_ENV_DNS_RECORD_TYPE" == "CNAME" ]] ||
        die "PR_ENV_DNS_RECORD_TYPE must be A, AAAA, or CNAME"

    if [[ "$ACTION" == "deploy" ]]; then
        require_env CLOUDFLARE_API_TOKEN
        require_env CLOUDFLARE_ZONE_ID
        require_env PR_ENV_DNS_RECORD_CONTENT
        require_env PR_ENV_OTEL_EXPORTER_OTLP_ENDPOINT
    fi
}

set_defaults() {
    PR_ENV_PROJECT_NAME="${PR_ENV_PROJECT_NAME:-xpenser}"
    PR_ENV_DOMAIN_SUFFIX="${PR_ENV_DOMAIN_SUFFIX:-cleverbrush.com}"
    PR_ENV_DOMAIN_PROJECT="${PR_ENV_DOMAIN_PROJECT:-$PR_ENV_PROJECT_NAME}"
    PASSPORT_BASE_URL="${PASSPORT_BASE_URL:-https://auth.cleverbrush.com}"
    PASSPORT_PROJECT="${PASSPORT_PROJECT:-$PR_ENV_PROJECT_NAME}"
    PROD_COMPOSE_PROJECT="${PROD_COMPOSE_PROJECT:-$PR_ENV_PROJECT_NAME}"
    PR_ENV_ROOT="${PR_ENV_ROOT:-/opt/pr-envs}"
    PR_ENV_STATE_DIR="${PR_ENV_STATE_DIR:-/var/lib/pr-envs}"
    PR_ENV_PORT_BASE="${PR_ENV_PORT_BASE:-3000}"
    GIT_REPOSITORY_URL="${GIT_REPOSITORY_URL:-git@github.com:cleverbrush/${PR_ENV_PROJECT_NAME}.git}"
    PR_ENV_DNS_RECORD_TYPE="${PR_ENV_DNS_RECORD_TYPE:-CNAME}"
    PR_ENV_DNS_RECORD_TYPE="${PR_ENV_DNS_RECORD_TYPE^^}"
    PR_ENV_DNS_RECORD_CONTENT="${PR_ENV_DNS_RECORD_CONTENT:-${PR_ENV_DOMAIN_PROJECT}.${PR_ENV_DOMAIN_SUFFIX}}"
    PR_ENV_DNS_RECORD_PROXIED="${PR_ENV_DNS_RECORD_PROXIED:-true}"
    PR_ENV_DNS_RECORD_TTL="${PR_ENV_DNS_RECORD_TTL:-1}"

    ENV_NAME="pr-${PR_NUMBER}"
    HOST_ENV_NAME="$(printf 'pr-%03d' "$PR_NUMBER")"
    COMPOSE_PROJECT="pr${PR_NUMBER}"
    PASSPORT_ENVIRONMENT="$ENV_NAME"
    DOMAIN="${PR_ENV_DOMAIN_PROJECT}-${HOST_ENV_NAME}.${PR_ENV_DOMAIN_SUFFIX}"
    CHECKOUT_DIR="${PR_ENV_ROOT}/${ENV_NAME}"
    STATE_DIR="${PR_ENV_STATE_DIR}/${ENV_NAME}"
    STATE_FILE="${STATE_DIR}/state.env"
    DB_INITIALIZED_FILE="${STATE_DIR}/db.initialized"
    POSTGRES_DB="${POSTGRES_DB:-$PR_ENV_PROJECT_NAME}"
    POSTGRES_USER="${POSTGRES_USER:-$PR_ENV_PROJECT_NAME}"
}

load_state() {
    if [[ -f "$STATE_FILE" ]]; then
        # shellcheck disable=SC1090
        source "$STATE_FILE"
    fi
}

save_state() {
    write_shell_env "$STATE_FILE" \
        WEB_PORT "$WEB_PORT" \
        POSTGRES_PASSWORD "$POSTGRES_PASSWORD" \
        JWT_SECRET "$JWT_SECRET" \
        WEB_API_SERVICE_SECRET "$WEB_API_SERVICE_SECRET" \
        NEXTAUTH_SECRET "$NEXTAUTH_SECRET" \
        TELEGRAM_BOT_SERVICE_SECRET "$TELEGRAM_BOT_SERVICE_SECRET" \
        CLOUDFLARE_DNS_RECORD_ID "${CLOUDFLARE_DNS_RECORD_ID:-}" \
        CLOUDFLARE_DNS_RECORD_NAME "${CLOUDFLARE_DNS_RECORD_NAME:-}" \
        CLOUDFLARE_DNS_RECORD_TYPE "${CLOUDFLARE_DNS_RECORD_TYPE:-$PR_ENV_DNS_RECORD_TYPE}"
    chmod 600 "$STATE_FILE"
}

ensure_state() {
    ensure_writable_dir "$PR_ENV_ROOT"
    ensure_writable_dir "$PR_ENV_STATE_DIR"
    ensure_writable_dir "$STATE_DIR"
    load_state
    WEB_PORT="$((10#$PR_ENV_PORT_BASE + 10#$PR_NUMBER))"

    POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(random_secret)}"
    JWT_SECRET="${JWT_SECRET:-$(random_secret)}"
    WEB_API_SERVICE_SECRET="${WEB_API_SERVICE_SECRET:-$(random_secret)}"
    NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(random_secret)}"
    TELEGRAM_BOT_SERVICE_SECRET="${TELEGRAM_BOT_SERVICE_SECRET:-$(random_secret)}"

    save_state
}

compose() {
    docker compose \
        --project-name "$COMPOSE_PROJECT" \
        --env-file "${CHECKOUT_DIR}/.env" \
        -f "${CHECKOUT_DIR}/docker-compose.prod.yml" \
        "$@"
}

find_compose_container() {
    local project="$1"
    local service="$2"

    docker ps \
        --filter "label=com.docker.compose.project=${project}" \
        --filter "label=com.docker.compose.service=${service}" \
        --format '{{.ID}}' |
        head -n 1
}

wait_for_container_healthy() {
    local container_id="$1"
    local name="$2"
    local timeout_seconds="${3:-120}"
    local started_at

    started_at="$(date +%s)"
    while true; do
        local status
        status="$(
            docker inspect \
                --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
                "$container_id"
        )"

        if [[ "$status" == "healthy" || "$status" == "running" ]]; then
            return
        fi

        if (( $(date +%s) - started_at > timeout_seconds )); then
            die "Timed out waiting for ${name} to become healthy; last status: ${status}"
        fi

        sleep 2
    done
}

sync_repo() {
    ensure_writable_dir "$(dirname "$CHECKOUT_DIR")"

    if [[ ! -d "${CHECKOUT_DIR}/.git" ]]; then
        log "Cloning repository into ${CHECKOUT_DIR}"
        git clone --no-checkout "$GIT_REPOSITORY_URL" "$CHECKOUT_DIR"
    fi

    git -C "$CHECKOUT_DIR" remote set-url origin "$GIT_REPOSITORY_URL"
    git -C "$CHECKOUT_DIR" fetch --depth=1 origin \
        "+refs/pull/${PR_NUMBER}/head:refs/remotes/origin/pr-${PR_NUMBER}"
    git -C "$CHECKOUT_DIR" checkout --force "$PR_SHA"
    git -C "$CHECKOUT_DIR" reset --hard "$PR_SHA"
    git -C "$CHECKOUT_DIR" clean -fdx -e .env
}

initialize_database() {
    if [[ -f "$DB_INITIALIZED_FILE" ]]; then
        log "PR database already initialized; preserving existing volume"
        return
    fi

    local prod_container
    local pr_container
    local prod_db
    local prod_user
    local prod_password

    prod_container="$(find_compose_container "$PROD_COMPOSE_PROJECT" postgres)"
    [[ -n "$prod_container" ]] ||
        die "Could not find running production postgres container for project ${PROD_COMPOSE_PROJECT}"

    pr_container="$(find_compose_container "$COMPOSE_PROJECT" postgres)"
    [[ -n "$pr_container" ]] ||
        die "Could not find PR postgres container for project ${COMPOSE_PROJECT}"

    prod_db="$(docker exec "$prod_container" printenv POSTGRES_DB 2>/dev/null || true)"
    prod_user="$(docker exec "$prod_container" printenv POSTGRES_USER 2>/dev/null || true)"
    prod_password="$(docker exec "$prod_container" printenv POSTGRES_PASSWORD 2>/dev/null || true)"
    prod_db="${prod_db:-$POSTGRES_DB}"
    prod_user="${prod_user:-$POSTGRES_USER}"

    log "Copying production database into ${COMPOSE_PROJECT}_postgres_data"
    docker exec -e "PGPASSWORD=${prod_password}" "$prod_container" \
        pg_dump --format=custom --no-owner --no-privileges \
        -U "$prod_user" -d "$prod_db" |
        docker exec -i -e "PGPASSWORD=${POSTGRES_PASSWORD}" "$pr_container" \
            pg_restore --clean --if-exists --no-owner --no-privileges \
            -U "$POSTGRES_USER" -d "$POSTGRES_DB"

    touch "$DB_INITIALIZED_FILE"
}

passport_headers() {
    curl -fsSL \
        -H "Authorization: ServiceKey ${PASSPORT_SERVICE_KEY}" \
        -H 'Content-Type: application/json' \
        "$@"
}

urlencode() {
    jq -nr --arg value "$1" '$value | @uri'
}

passport_environment_url() {
    local environment_name="$1"
    local encoded_project
    local encoded_environment

    encoded_project="$(urlencode "$PASSPORT_PROJECT")"
    encoded_environment="$(urlencode "$environment_name")"
    printf '%s/api/projects/%s/environments/%s' \
        "${PASSPORT_BASE_URL%/}" \
        "$encoded_project" \
        "$encoded_environment"
}

upsert_passport_environment() {
    local body

    body="$(
        jq -n \
            --arg frontend_origin "https://${DOMAIN}" \
            --arg backend_auth_url "https://${DOMAIN}/external-api/auth/passport" \
            '{
                frontend_origin: $frontend_origin,
                callback_path: "/auth/callback",
                backend_auth_url: $backend_auth_url,
                status: "active"
            }'
    )"

    log "Creating Passport environment ${PASSPORT_ENVIRONMENT}"
    passport_headers \
        -X PUT \
        -d "$body" \
        "$(passport_environment_url "$PASSPORT_ENVIRONMENT")" \
        >/dev/null
}

list_matching_passport_environment_names() {
    local response_file
    local status
    local url

    response_file="$(mktemp)"
    url="${PASSPORT_BASE_URL%/}/api/projects/$(urlencode "$PASSPORT_PROJECT")/environments"

    status="$(
        curl -sSL \
            -o "$response_file" \
            -w '%{http_code}' \
            -H "Authorization: ServiceKey ${PASSPORT_SERVICE_KEY}" \
            -H 'Content-Type: application/json' \
            "$url" || true
    )"

    if [[ "$status" != "200" ]]; then
        log "Passport environment list failed with HTTP ${status}: $(tr '\n' ' ' <"$response_file")"
        rm -f "$response_file"
        return 1
    fi

    jq -r \
        --arg env "$PASSPORT_ENVIRONMENT" \
        --arg host_env "$HOST_ENV_NAME" \
        --arg frontend_origin "https://${DOMAIN}" \
        --arg backend_auth_url "https://${DOMAIN}/external-api/auth/passport" \
        '(. // [])[]? |
            select(
                .name == $env or
                .name == $host_env or
                (.frontendOrigin // .frontend_origin // "") == $frontend_origin or
                (.backendAuthUrl // .backend_auth_url // "") == $backend_auth_url
            ) |
            .name' \
        "$response_file"
    rm -f "$response_file"
}

delete_passport_environment_name() {
    local environment_name="$1"
    local response_file
    local status
    local url

    response_file="$(mktemp)"
    url="$(passport_environment_url "$environment_name")"

    log "Deleting Passport environment ${environment_name}"
    status="$(
        curl -sSL \
            -o "$response_file" \
            -w '%{http_code}' \
            -H "Authorization: ServiceKey ${PASSPORT_SERVICE_KEY}" \
            -H 'Content-Type: application/json' \
            -X DELETE \
            "$url" || true
    )"

    case "$status" in
        200|202|204)
            rm -f "$response_file"
            return 0
            ;;
        404)
            log "Passport environment ${environment_name} is already absent"
            rm -f "$response_file"
            return 0
            ;;
        *)
            log "Passport environment delete failed with HTTP ${status}: $(tr '\n' ' ' <"$response_file")"
            rm -f "$response_file"
            return 1
            ;;
    esac
}

delete_passport_environment() {
    local candidate_file
    local environment_name
    local failed=0
    local list_failed=0
    local seen_names=" "

    candidate_file="$(mktemp)"
    {
        printf '%s\n' "$PASSPORT_ENVIRONMENT"
        printf '%s\n' "$HOST_ENV_NAME"
        list_matching_passport_environment_names || list_failed=1
    } >"$candidate_file"

    while IFS= read -r environment_name; do
        [[ -n "$environment_name" ]] || continue
        if [[ "$seen_names" == *" ${environment_name} "* ]]; then
            continue
        fi
        seen_names="${seen_names}${environment_name} "
        delete_passport_environment_name "$environment_name" || failed=1
    done <"$candidate_file"

    rm -f "$candidate_file"

    if (( list_failed != 0 || failed != 0 )); then
        return 1
    fi
}

cloudflare_enabled() {
    [[ -n "${CLOUDFLARE_API_TOKEN:-}" && -n "${CLOUDFLARE_ZONE_ID:-}" ]]
}

cloudflare_headers() {
    curl -fsS \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        -H 'Content-Type: application/json' \
        "$@"
}

find_cloudflare_dns_record_ids() {
    local record_name="$1"
    local record_type="${2:-}"
    local curl_args=(
        -G
        --data-urlencode "name=${record_name}"
    )
    local response

    if [[ -n "$record_type" ]]; then
        curl_args+=(--data-urlencode "type=${record_type}")
    fi

    response="$(
        cloudflare_headers \
            "${curl_args[@]}" \
            "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records"
    )"

    jq -er '.success == true' <<<"$response" >/dev/null ||
        die "Cloudflare DNS record lookup failed"
    jq -r '.result[].id' <<<"$response"
}

delete_cloudflare_dns_record_id() {
    local record_id="$1"
    local response

    response="$(
        cloudflare_headers \
            -X DELETE \
            "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${record_id}"
    )"
    if ! jq -er '.success == true' <<<"$response" >/dev/null; then
        log "Cloudflare DNS record delete failed for ${record_id}"
        return 1
    fi
}

upsert_cloudflare_dns_record() {
    local existing_ids
    local body
    local response

    mapfile -t existing_ids < <(
        find_cloudflare_dns_record_ids "$DOMAIN"
    )

    for record_id in "${existing_ids[@]}"; do
        log "Deleting existing Cloudflare DNS record ${record_id} for ${DOMAIN}"
        delete_cloudflare_dns_record_id "$record_id"
    done

    body="$(
        jq -n \
            --arg type "$PR_ENV_DNS_RECORD_TYPE" \
            --arg name "$DOMAIN" \
            --arg content "$PR_ENV_DNS_RECORD_CONTENT" \
            --arg comment "PR environment ${ENV_NAME}" \
            --argjson proxied "$PR_ENV_DNS_RECORD_PROXIED" \
            --argjson ttl "$PR_ENV_DNS_RECORD_TTL" \
            '{
                type: $type,
                name: $name,
                content: $content,
                ttl: $ttl,
                proxied: $proxied,
                comment: $comment
            }'
    )"

    log "Creating Cloudflare DNS record ${DOMAIN}"
    response="$(
        cloudflare_headers \
            -X POST \
            -d "$body" \
            "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records"
    )"
    jq -er '.success == true' <<<"$response" >/dev/null ||
        die "Cloudflare DNS record create failed for ${DOMAIN}"

    CLOUDFLARE_DNS_RECORD_ID="$(jq -r '.result.id' <<<"$response")"
    CLOUDFLARE_DNS_RECORD_NAME="$DOMAIN"
    CLOUDFLARE_DNS_RECORD_TYPE="$PR_ENV_DNS_RECORD_TYPE"
    save_state
}

delete_cloudflare_dns_record() {
    local record_name="${CLOUDFLARE_DNS_RECORD_NAME:-$DOMAIN}"
    local record_id
    local existing_ids
    local failed=0

    if ! cloudflare_enabled; then
        log "Skipping Cloudflare DNS cleanup because credentials are not configured"
        return
    fi

    if [[ -n "${CLOUDFLARE_DNS_RECORD_ID:-}" ]]; then
        log "Deleting Cloudflare DNS record ${CLOUDFLARE_DNS_RECORD_ID} for ${record_name}"
        delete_cloudflare_dns_record_id "$CLOUDFLARE_DNS_RECORD_ID" || failed=1
    fi

    mapfile -t existing_ids < <(
        find_cloudflare_dns_record_ids "$record_name"
    )

    for record_id in "${existing_ids[@]}"; do
        [[ "$record_id" == "${CLOUDFLARE_DNS_RECORD_ID:-}" ]] && continue
        log "Deleting Cloudflare DNS record ${record_id} for ${record_name}"
        delete_cloudflare_dns_record_id "$record_id" || failed=1
    done

    return "$failed"
}

deploy() {
    require_env PASSPORT_SERVICE_KEY

    ensure_state
    upsert_cloudflare_dns_record
    sync_repo
    write_compose_env "${CHECKOUT_DIR}/.env"
    chmod 600 "${CHECKOUT_DIR}/.env"

    upsert_passport_environment

    log "Starting PR postgres for ${ENV_NAME}"
    compose up -d postgres
    local pr_postgres
    pr_postgres="$(find_compose_container "$COMPOSE_PROJECT" postgres)"
    [[ -n "$pr_postgres" ]] ||
        die "Could not find PR postgres container after compose up"
    wait_for_container_healthy "$pr_postgres" "${COMPOSE_PROJECT} postgres" 180
    initialize_database

    log "Building and starting PR web/API for ${ENV_NAME}"
    compose up -d --build --remove-orphans api web

    local api_container
    api_container="$(find_compose_container "$COMPOSE_PROJECT" api)"
    [[ -n "$api_container" ]] ||
        die "Could not find PR api container after compose up"
    wait_for_container_healthy "$api_container" "${COMPOSE_PROJECT} api" 240

    log "PR environment ready: https://${DOMAIN}"
}

cleanup() {
    local cleanup_failed=0

    load_state || true

    if [[ -d "$CHECKOUT_DIR" && -f "${CHECKOUT_DIR}/docker-compose.prod.yml" ]]; then
        if [[ -f "${CHECKOUT_DIR}/.env" ]]; then
            log "Stopping Docker Compose project ${COMPOSE_PROJECT}"
            compose down -v --remove-orphans --rmi local || true
        else
            docker compose \
                --project-name "$COMPOSE_PROJECT" \
                -f "${CHECKOUT_DIR}/docker-compose.prod.yml" \
                down -v --remove-orphans --rmi local || true
        fi
    else
        log "Removing Docker resources for ${COMPOSE_PROJECT}"
        docker ps -aq \
            --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" |
            xargs -r docker rm -f || true
        docker volume rm "${COMPOSE_PROJECT}_postgres_data" >/dev/null 2>&1 || true
        docker network rm "${COMPOSE_PROJECT}_default" >/dev/null 2>&1 || true
    fi

    if [[ -n "${PASSPORT_SERVICE_KEY:-}" ]]; then
        delete_passport_environment || cleanup_failed=1
    else
        log "Skipping Passport cleanup because PASSPORT_SERVICE_KEY is not configured"
    fi

    delete_cloudflare_dns_record || cleanup_failed=1

    rm -rf "${PR_ENV_ROOT:?}/${ENV_NAME}" "$STATE_DIR"
    log "Pruning unused Docker resources"
    docker system prune -f || true
    if (( cleanup_failed != 0 )); then
        die "Cleanup completed with errors"
    fi
    log "Cleaned PR environment ${ENV_NAME}"
}

main() {
    validate_inputs
    require_command base64
    load_secret_stream
    set_defaults
    validate_config

    require_command curl
    require_command docker
    require_command git
    require_command jq
    require_command mktemp
    require_command openssl

    case "$ACTION" in
        deploy) deploy ;;
        cleanup) cleanup ;;
        *) usage ;;
    esac
}

main "$@"
