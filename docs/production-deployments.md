# Automatic production deployments

Every push to `main`, including a merged PR or direct push, runs the
`Production` workflow. It validates the triggering commit, then deploys that
exact revision. Manual workflow dispatch is allowed only on `main` and
retries its current revision. Superseded queued revisions are skipped before
validation. An admitted run finishes even if another update arrives.

Production workflows share one concurrency group with cancellation disabled and
`queue: max`. See [GitHub concurrency documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
Actionlint 1.7.12 does not yet recognize the documented `queue` property; when
using that version, ignore only `unexpected key "queue" for "concurrency"`.
All other Actionlint checks remain enabled.

## Connections and credentials

The route is GitHub Actions → existing public ingress → `10.200.1.2`. Dedicated
production accounts and keys are separate from preview credentials. Each SSH
key has a forced command that accepts only `deploy <40-character-commit-sha>`;
interactive shells, forwarding, arbitrary commands, and environment prefixes
are rejected. Both SSH hops pin host keys.

The GitHub environment `production` allows only `main` and has no required
reviewers or deployment delay. Its secrets are:

| Secret | Purpose |
| --- | --- |
| `PROD_DEPLOY_SSH_USER` | Dedicated ingress user, `xpenser-prod-deploy`. |
| `PROD_DEPLOY_SSH_PRIVATE_KEY` | Actions-to-ingress key, never a preview key. |
| `PROD_DEPLOY_SSH_HOST` | Public ingress SSH address. |
| `PROD_DEPLOY_SSH_PORT` | SSH port, default `22`. |
| `PROD_DEPLOY_SSH_KNOWN_HOSTS` | Pinned public ingress host keys. |

Host, port, and known-host secrets may fall back to the existing
`PR_ENV_NGINX_SSH_*` connection metadata when unset. The user and private key
never fall back to preview credentials. `PROD_DEPLOY_URL` is an optional GitHub
variable; its default is `https://xpenser.cleverbrush.com`.

## Installed runners

Install reviewed scripts outside application checkouts. Application deployment
does not update the installed runners automatically.

On the production host, `/opt/prod-deploy` contains `prod-deploy.sh`,
`prod-deploy-restricted-ssh-command` (installed as `restricted-ssh-command`),
and a root-only `prod-deploy.env`:

```sh
PROD_DEPLOY_PROJECT=xpenser
PROD_DEPLOY_BRANCH=main
PROD_DEPLOY_REPOSITORY_URL=git@github.com:cleverbrush/xpenser.git
PROD_DEPLOY_ENV_FILE=/root/projects/xpenser/.env
PROD_DEPLOY_URL=https://xpenser.cleverbrush.com
```

The defaults are state directory `/var/lib/prod-deploy/xpenser`, health timeout
300 seconds, and shared image-build lock `/var/lock/app-image-build.lock`.
Overrides are `PROD_DEPLOY_STATE_DIR`, `PROD_DEPLOY_HEALTH_TIMEOUT`, and
`PROD_DEPLOY_BUILD_LOCK`. The host requires Bash, Docker Compose v2 with `--wait`,
Git with repository access, jq, curl, tar, and flock. PostgreSQL and all three
application containers must already exist.

The ingress-to-production public key is restricted in root's `authorized_keys`:

```text
restrict,command="/opt/prod-deploy/restricted-ssh-command runner" ssh-ed25519 <production-public-key>
```

On ingress, `/opt/prod-deploy/xpenser` contains `prod-deploy-proxy.sh`,
`restricted-ssh-command`, and `prod-deploy.env`. Scripts/configuration are
root-owned and readable/executable only by the dedicated production account's
group. Its configuration is:

```sh
PROD_DEPLOY_TARGET_HOST=10.200.1.2
PROD_DEPLOY_TARGET_USER=root
PROD_DEPLOY_TARGET_PORT=22
PROD_DEPLOY_TARGET_KEY=/home/xpenser-prod-deploy/.ssh/production-host
PROD_DEPLOY_TARGET_KNOWN_HOSTS=/home/xpenser-prod-deploy/.ssh/known_hosts
```

The Actions-to-ingress public key is restricted in the dedicated user's
`authorized_keys`:

```text
restrict,command="/opt/prod-deploy/xpenser/restricted-ssh-command proxy" ssh-ed25519 <actions-public-key>
```

## Release behavior

The runner holds a production-deployment lock, fetches only `main` into its
own Git cache, verifies commit ancestry, and refuses older/divergent revisions
relative to the last successful or partially attempted deployment. This also
prevents an old manual retry from overwriting a newer release.

Each attempt has an isolated source archive and Compose image override under
`/var/lib/prod-deploy/xpenser/releases`. Images for `api`, `web`, and
`telegram-bot` are tagged with the full commit SHA and labelled with source,
revision, and package version. All images build sequentially before containers
change. Production and preview runners acquire the same host build lock;
preview builds also use Compose parallelism of one. Install the updated
`pr-env.sh` into its existing stable location to enable that shared lock.

Compose explicitly uses project `xpenser`, the release's Compose files,
and `/root/projects/xpenser/.env`. Production secrets are never copied into release
source directories. Existing checkout files and untracked backups are preserved.
API startup runs its usual database migrations and must become healthy before
web and Telegram are replaced. PostgreSQL is never included in a create,
recreate, stop, or removal command. Its container identity is checked afterwards.
Public homepage and `/api/health` checks run on both the host and Actions runner.
The Telegram container must remain running.

`current.json` records the last successful release, `previous.json` retains the
preceding release, and `last-attempt.json` records any attempt that reached
container replacement. Initial setup captures the existing deployment as the
baseline, including its original Compose-file list. Failed attempts retain
`previous-containers.json`, `containers.log`, and `services.log` in the attempt
directory. State, diagnostics, and release files are root-only. The production
runner does not prune images or releases.

## Recovery and validation

Failures return a nonzero status and mark the GitHub deployment failed. Build
failures leave running containers untouched. Startup or smoke failures require
manual recovery; startup migrations may make older application images
incompatible, so applications and databases are never automatically rolled back.

Inspect the recorded attempt and its diagnostics on the production host. For a
known compatible previous release, use its recorded `compose_files`,
`project_directory`, and `env_file` with `docker compose --project-name xpenser`.
Recreate only `api`, then `web telegram-bot`, using `--no-build --no-deps --wait`.
The first baseline records the pre-automation Compose files, including any
existing release override. Preserve PostgreSQL and its volumes during recovery.
After manual recovery, reconcile `current.json` and `last-attempt.json` before
retrying automation. A workflow retry can safely retry the same attempted SHA
or a newer descendant. Never edit release records to bypass migration review.

Run `npm run test:deploy` for isolated temporary-repository tests of ancestry,
failed builds, rollout/health failures, secret preservation, SSH restrictions,
and both locks. Both PR and production workflows run these tests. Also run
Bash syntax checks, ShellCheck, and Actionlint when changing deployment files.
