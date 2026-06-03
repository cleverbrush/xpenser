# PR Environment Setup

This repo contains three pieces for ephemeral PR environments:

- `.github/workflows/pr-environments.yml`: runs CI, then SSHes to the nginx
  host.
- `pr-env-proxy.sh`: the nginx-host proxy script. Copy this file to the nginx
  host yourself; the workflow never uploads or rewrites it.
- `pr-env.sh`: the private environment-host deploy/cleanup script. Copy this
  file to the environment host yourself.

The SSH flow is:

```text
GitHub Actions -> nginx host -> private environment host
```

GitHub stores only the nginx SSH connection details. The private environment
host address, SSH key path, user, and script path live in the nginx-host proxy
config.

HTTP traffic is separate:

```text
Cloudflare per-PR DNS record -> nginx host -> environment host port 3000 + PR number
```

Use a dedicated preview network for the environment host. PR code should be
treated as hostile: do not put the environment host directly in the same flat
LAN as Proxmox, storage, databases, or other VMs.

## Hosts

There are two hosts:

- **Environment host**: private Debian 13 machine that runs Docker Compose PR
  environments and the installed `pr-env.sh` script. This host does not need a
  public IP and does not run nginx.
- **Nginx host**: public nginx machine that receives HTTP traffic, calculates
  the target PR port, and runs `pr-env-proxy.sh` when GitHub Actions connects
  over SSH.

## Network Isolation

Recommended layout for your Proxmox/OpenWrt setup:

```text
Existing LAN:           10.30.0.0/16
nginx LAN IP:           10.30.1.11

PR DMZ network:         10.200.1.0/24
OpenWrt PR DMZ IP:      10.200.1.1
PR environment host IP: 10.200.1.2
```

The OpenWrt router VM gets a new NIC in the PR DMZ. The PR environment host
lives in the PR DMZ and should not also be attached to `10.30.0.0/16` unless
you have a separate locked-down management plan. The nginx host can stay on the
existing LAN and route to `10.200.1.2` through OpenWrt.

### Proxmox Network

1. Create an isolated Proxmox network for PR environments.

If OpenWrt and the PR host are on the same Proxmox node, a Linux bridge with no
physical bridge port is enough:

```text
Bridge name: vmbr-prenv
IPv4/CIDR:   empty
Bridge ports: empty
VLAN aware:  no
```

If these VMs may move across nodes, use a VLAN or Proxmox SDN VNet instead and
attach the same PR DMZ network to all relevant nodes.

2. Add a VirtIO NIC on `vmbr-prenv` to the OpenWrt VM.

3. Attach the PR environment host NIC to `vmbr-prenv`.

### OpenWrt Router VM

Configure the new OpenWrt NIC as a static PR DMZ interface. Replace `ethX` with
the new interface name shown by `ip link` inside OpenWrt:

```sh
uci set network.prdmz='interface'
uci set network.prdmz.proto='static'
uci set network.prdmz.device='ethX'
uci set network.prdmz.ipaddr='10.200.1.1'
uci set network.prdmz.netmask='255.255.255.0'
uci commit network
/etc/init.d/network reload
```

Create a dedicated firewall zone. This allows PR hosts to reach the internet
through `wan`, but does not allow PR hosts to reach the existing `lan` zone:

```sh
uci add firewall zone
uci set firewall.@zone[-1].name='prdmz'
uci set firewall.@zone[-1].network='prdmz'
uci set firewall.@zone[-1].input='DROP'
uci set firewall.@zone[-1].output='ACCEPT'
uci set firewall.@zone[-1].forward='DROP'

uci add firewall forwarding
uci set firewall.@forwarding[-1].src='prdmz'
uci set firewall.@forwarding[-1].dest='wan'

uci add firewall rule
uci set firewall.@rule[-1].name='Allow-PRDMZ-DNS-to-router'
uci set firewall.@rule[-1].src='prdmz'
uci set firewall.@rule[-1].proto='tcp udp'
uci set firewall.@rule[-1].dest_port='53'
uci set firewall.@rule[-1].target='ACCEPT'

uci add firewall rule
uci set firewall.@rule[-1].name='Allow-nginx-SSH-to-PR-host'
uci set firewall.@rule[-1].src='lan'
uci set firewall.@rule[-1].src_ip='10.30.1.11'
uci set firewall.@rule[-1].dest='prdmz'
uci set firewall.@rule[-1].dest_ip='10.200.1.2'
uci set firewall.@rule[-1].proto='tcp'
uci set firewall.@rule[-1].dest_port='22'
uci set firewall.@rule[-1].target='ACCEPT'

uci add firewall rule
uci set firewall.@rule[-1].name='Allow-nginx-preview-to-PR-host'
uci set firewall.@rule[-1].src='lan'
uci set firewall.@rule[-1].src_ip='10.30.1.11'
uci set firewall.@rule[-1].dest='prdmz'
uci set firewall.@rule[-1].dest_ip='10.200.1.2'
uci set firewall.@rule[-1].proto='tcp'
uci set firewall.@rule[-1].dest_port='3000-3999'
uci set firewall.@rule[-1].target='ACCEPT'

uci commit firewall
/etc/init.d/firewall restart
```

Do not add broad forwarding between `lan` and `prdmz`; keep only the explicit
nginx-to-PR-host rules above. Do not add forwarding from `prdmz` to `lan`. If
your OpenWrt `wan` side can reach private networks through VPNs or static
routes, add explicit reject rules for those private ranges before allowing
general internet egress. Also verify that masquerading is enabled on the `wan`
zone, otherwise PR hosts may not have working internet egress.

### Nginx Host Routing

The nginx host does not need a PR DMZ NIC. It must be able to route to
`10.200.1.2` through OpenWrt. Verify this from the nginx host:

```sh
ip route get 10.200.1.2
nc -vz 10.200.1.2 22
```

The existing nginx address `10.30.1.11` remains the address GitHub Actions SSHes
to and the address Cloudflare preview DNS records resolve to.

### PR Environment Host NIC

Configure the PR environment host with a static address in the PR DMZ:

```text
Address: 10.200.1.2/24
Gateway: 10.200.1.1
DNS:     10.200.1.1, or public resolvers if you do not want OpenWrt DNS
```

Use `10.200.1.2` wherever this guide refers to
`<environment-host-private-ip>`.

### Data Safety

Network isolation does not make untrusted PR code safe to run next to production
data. The current deploy script initializes PR databases from the production
Compose PostgreSQL service. For untrusted contributors, prefer a sanitized dump,
schema-only restore, or seed data export instead of copying production data.

## Environment Host

4. Install environment host dependencies:

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates curl git jq openssh-client openssl util-linux
```

Docker with Compose v2 must also be installed. On Debian, install it from your
preferred Docker source, then verify:

```sh
docker --version
docker compose version
```

The deploy user must be able to run `docker` without an interactive password
prompt.

The environment host should not run unrelated Docker workloads. PR cleanup runs
`docker system prune -f` after removing the PR Compose project, which clears
stopped containers, unused networks, dangling images, and build cache.

5. Copy the deploy script to the environment host:

```sh
sudo install -m 700 pr-env.sh /opt/pr-env/pr-env.sh
sudo chown <environment-deploy-user>:<environment-deploy-user> /opt/pr-env/pr-env.sh
```

6. Prepare writable directories for PR checkouts and state:

```sh
sudo install -d -m 750 -o <environment-deploy-user> -g <environment-deploy-user> /opt/pr-envs
sudo install -d -m 750 -o <environment-deploy-user> -g <environment-deploy-user> /var/lib/pr-envs
```

7. Allow SSH from the nginx host to the environment host as
   `<environment-deploy-user>`. The nginx host will use this SSH path to run
   `/opt/pr-env/pr-env.sh`.

8. Make sure the environment host can clone the repo:

```sh
sudo -u <environment-deploy-user> ssh -T git@github.com
sudo -u <environment-deploy-user> git ls-remote git@github.com:cleverbrush/xpenser.git
```

The environment host should have an SSH key with read access to this repository.

9. Make sure production is running on the environment host through Docker
   Compose with project name `xpenser` and service name `postgres`. If the
   production Compose project name is different, set GitHub variable
   `PROD_COMPOSE_PROJECT`.

10. Open the environment host firewall so only the nginx host can reach PR
   preview ports. With the default port base, PR `N` runs on port `3000 + N`.

## Nginx Host

11. Install nginx, njs, and SSH client tooling on the nginx host:

```sh
sudo apt-get update
sudo apt-get install -y nginx libnginx-mod-http-js openssh-client
```

12. Copy the proxy script to the nginx host:

```sh
sudo install -m 700 pr-env-proxy.sh /opt/pr-env/pr-env-proxy.sh
sudo chown <nginx-deploy-user>:<nginx-deploy-user> /opt/pr-env/pr-env-proxy.sh
```

Use the final path as GitHub secret `PR_ENV_NGINX_PROXY_SCRIPT`.

13. Configure SSH from the nginx host to the private environment host. The
    nginx deploy user needs a key that can log in as the environment deploy user:

```sh
sudo install -d -m 700 -o <nginx-deploy-user> -g <nginx-deploy-user> /home/<nginx-deploy-user>/.ssh
sudo install -m 600 pr-env-host.key /home/<nginx-deploy-user>/.ssh/pr-env-host
sudo chown <nginx-deploy-user>:<nginx-deploy-user> /home/<nginx-deploy-user>/.ssh/pr-env-host
ssh-keyscan -H 10.200.1.2 | sudo tee -a /home/<nginx-deploy-user>/.ssh/known_hosts >/dev/null
sudo chown <nginx-deploy-user>:<nginx-deploy-user> /home/<nginx-deploy-user>/.ssh/known_hosts
sudo chmod 600 /home/<nginx-deploy-user>/.ssh/known_hosts
```

14. Create the nginx-host proxy config:

```sh
sudo install -d -m 750 -o <nginx-deploy-user> -g <nginx-deploy-user> /etc/pr-env
sudo tee /etc/pr-env/pr-env-proxy.env >/dev/null <<'ENV'
PR_ENV_TARGET_SSH_HOST=10.200.1.2
PR_ENV_TARGET_SSH_USER=<environment-deploy-user>
PR_ENV_TARGET_SSH_PORT=22
PR_ENV_TARGET_SSH_KEY=/home/<nginx-deploy-user>/.ssh/pr-env-host
PR_ENV_TARGET_SSH_KNOWN_HOSTS_FILE=/home/<nginx-deploy-user>/.ssh/known_hosts
PR_ENV_TARGET_SCRIPT=/opt/pr-env/pr-env.sh
ENV
sudo chown <nginx-deploy-user>:<nginx-deploy-user> /etc/pr-env/pr-env-proxy.env
sudo chmod 600 /etc/pr-env/pr-env-proxy.env
```

Verify the nginx deploy user can reach the environment host:

```sh
sudo -u <nginx-deploy-user> ssh -i /home/<nginx-deploy-user>/.ssh/pr-env-host \
  <environment-deploy-user>@10.200.1.2 \
  'test -x /opt/pr-env/pr-env.sh && docker compose version'
```

15. Create a Cloudflare API token that can edit DNS records for
    `cleverbrush.com`. The deploy script creates one exact DNS record per PR,
    such as `xpenser-pr-003.cleverbrush.com`, and deletes it during cleanup.
    The record defaults to a proxied CNAME pointing at
    `xpenser.cleverbrush.com`, so the normal `*.cleverbrush.com` edge
    certificate can cover preview traffic.

16. Configure nginx njs routing on the nginx host. First create the static port
    calculation script:

```sh
sudo tee /etc/nginx/pr-port.js >/dev/null <<'JS'
var portBase = 3000;

function port(r) {
    var host = r.variables.host || r.headersIn.Host || '';
    var match = host.match(/^[^.]+-pr-0*(\d+)\./);

    if (!match) {
        return '0';
    }

    return String(portBase + Number(match[1]));
}

export default { port };
JS
sudo chmod 0644 /etc/nginx/pr-port.js
```

Then make sure nginx loads the HTTP JavaScript module. The Debian package often
creates this automatically, but this command is safe if the file does not exist:

```sh
if ! sudo grep -Rqs 'ngx_http_js_module' /etc/nginx/nginx.conf /etc/nginx/modules-enabled; then
  echo 'load_module modules/ngx_http_js_module.so;' |
    sudo tee /etc/nginx/modules-enabled/50-mod-http-js.conf >/dev/null
fi
```

Create one static nginx config for all PR environments. Replace
`10.200.1.2` if you chose a different PR host address:

```sh
sudo tee /etc/nginx/conf.d/pr-envs.conf >/dev/null <<'NGINX'
js_import pr from /etc/nginx/pr-port.js;

server {
    listen 80;
    server_name ~^xpenser-pr-(?<pr>\d+)\.cleverbrush\.com$;

    js_set $target_port pr.port;

    location / {
        if ($target_port = 0) {
            return 404;
        }

        proxy_pass http://10.200.1.2:$target_port;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

sudo nginx -t
sudo systemctl reload nginx
```

This nginx config is created once. The deploy script only updates Docker
environments on deterministic ports; nginx does not need per-PR updates. If you
change GitHub variable `PR_ENV_PORT_BASE`, update `portBase` in
`/etc/nginx/pr-port.js` to the same value.

## GitHub Setup

Create these repository secrets:

```text
PR_ENV_NGINX_SSH_HOST
PR_ENV_NGINX_SSH_USER
PR_ENV_NGINX_SSH_PRIVATE_KEY
PR_ENV_NGINX_SSH_KNOWN_HOSTS
PR_ENV_NGINX_PROXY_SCRIPT
PASSPORT_SERVICE_KEY
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ZONE_ID
BRANDFETCH_API_KEY
PR_ENV_GITHUB_TOKEN
```

Notes:

- `PR_ENV_NGINX_SSH_PRIVATE_KEY` is the private key GitHub Actions uses to SSH
  into the nginx host.
- `PR_ENV_NGINX_SSH_KNOWN_HOSTS` should contain the nginx host key. Generate it
  with `ssh-keyscan -p <port> <nginx-host>`.
- `PR_ENV_NGINX_PROXY_SCRIPT` is the absolute path where you installed
  `pr-env-proxy.sh`, for example `/opt/pr-env/pr-env-proxy.sh`.
- No GitHub secret is needed for the private environment host SSH key. That key
  lives on the nginx host and is referenced by `/etc/pr-env/pr-env-proxy.env`.
- `CLOUDFLARE_API_TOKEN` should be scoped to edit DNS for the
  `cleverbrush.com` zone.
- `CLOUDFLARE_ZONE_ID` is the Cloudflare zone ID for `cleverbrush.com`.
- `BRANDFETCH_API_KEY` is the server-side bearer token used by preview API
  services for merchant enrichment.
- `PR_ENV_GITHUB_TOKEN` should be a fine-grained personal access token scoped
  only to this repository with `Administration` repository permissions set to
  read/write. GitHub requires this permission to delete repository
  environments during cleanup.

Create optional secret `PR_ENV_NGINX_SSH_PORT` if the nginx SSH daemon does not
use port `22`.

Create required repository variable `PR_ENV_OTEL_EXPORTER_OTLP_ENDPOINT` with
the external collector's OTLP/HTTP base URL. Do not include signal paths such as
`/v1/traces`, `/v1/logs`, or `/v1/metrics`; the application telemetry setup
adds those paths.

Create these optional repository variables if you need non-default values:

```text
PR_ENV_DOMAIN_SUFFIX=cleverbrush.com
PR_ENV_DOMAIN_PROJECT=xpenser
PR_ENV_DNS_RECORD_TYPE=CNAME
PR_ENV_DNS_RECORD_CONTENT=xpenser.cleverbrush.com
PR_ENV_DNS_RECORD_PROXIED=true
PR_ENV_DNS_RECORD_TTL=1
PR_ENV_PROJECT_NAME=xpenser
PR_ENV_ROOT=/opt/pr-envs
PR_ENV_STATE_DIR=/var/lib/pr-envs
PR_ENV_PORT_BASE=3000
PROD_COMPOSE_PROJECT=xpenser
GIT_REPOSITORY_URL=git@github.com:cleverbrush/xpenser.git
PASSPORT_BASE_URL=https://auth.cleverbrush.com
PASSPORT_PROJECT=xpenser
POSTGRES_DB=xpenser
POSTGRES_USER=xpenser
MERCHANT_ENRICHMENT_ENABLED=0
MERCHANT_ENRICHMENT_TIMEOUT_MS=2000
```

## Merchant Enrichment Setup

Create a Brandfetch account with Transaction API access and add its server-side
API key as `BRANDFETCH_API_KEY`. This implementation uses the authenticated
Transaction API from the xpenser API service, so no `BRANDFETCH_CLIENT_ID` is
needed; that client ID is for public logo-link style integrations.

Add these values for merchant enrichment:

```text
GitHub repository secret:
BRANDFETCH_API_KEY

GitHub repository variables, optional:
MERCHANT_ENRICHMENT_ENABLED=0
MERCHANT_ENRICHMENT_TIMEOUT_MS=2000

Local or production Compose env:
BRANDFETCH_API_KEY=
MERCHANT_ENRICHMENT_ENABLED=0
MERCHANT_ENRICHMENT_TIMEOUT_MS=2000
```

Set `MERCHANT_ENRICHMENT_ENABLED=1` only after `BRANDFETCH_API_KEY` is present.
The merchant country passed to Brandfetch comes from `users.country_code`; new
users choose it at registration and existing users are backfilled to `US`.

Third-party accounts/API keys to create for this merchant feature:

```text
Brandfetch account with Transaction API access
Brandfetch server API key for BRANDFETCH_API_KEY
```

## Runtime Behavior

- On PR open, reopen, or new commit, CI runs `npm ci`, lint, typecheck, and unit
  tests.
- If CI succeeds and the PR branch is in `cleverbrush/xpenser`, GitHub Actions
  SSHes to the nginx host and runs the installed proxy script with `deploy`.
- The nginx proxy script forwards the same secret stream and command to
  `/opt/pr-env/pr-env.sh` on the private environment host.
- Fork PRs run CI only; they do not receive SSH or deployment secrets.
- The environment script creates or updates Passport environment `pr-N`, a
  Cloudflare DNS record for `<project>-pr-NNN.cleverbrush.com`, a checkout of
  the exact PR commit at `${PR_ENV_ROOT}/pr-N`, deterministic web port
  `3000 + N` by default, Docker Compose services under project `prN`, and no
  nginx-side per-PR state.
- The PR database is initialized once from production with
  `pg_dump`/`pg_restore`. Later commits preserve `prN_postgres_data`.
- On PR close, the workflow runs the proxy script with `cleanup`; the private
  environment host removes Docker, Passport, checkout, and state resources, then
  runs `docker system prune -f` to clear unused Docker artifacts.
- After remote cleanup, the workflow marks all GitHub deployments for the PR
  environment as `inactive` and deletes the GitHub repository environment. The
  cleanup job intentionally does not declare the GitHub environment itself,
  because that would create a fresh active deployment while tearing the preview
  down.
- The same workflow can also be run manually with `workflow_dispatch` and a
  `pr_number` input to retry cleanup for an already-closed PR.

## Manual Smoke Test

First test the environment host script directly from the environment host:

```sh
export PASSPORT_SERVICE_KEY=...
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ZONE_ID=...
export GIT_REPOSITORY_URL=git@github.com:cleverbrush/xpenser.git
export PR_ENV_OTEL_EXPORTER_OTLP_ENDPOINT=https://collector.example.com

/opt/pr-env/pr-env.sh deploy 123 <commit-sha>
/opt/pr-env/pr-env.sh cleanup 123
```

Then test the nginx proxy from the nginx host with the same base64 stream that
GitHub Actions sends:

```sh
export PASSPORT_SERVICE_KEY=...
export PR_ENV_OTEL_EXPORTER_OTLP_ENDPOINT=https://collector.example.com

b64() {
  printf '%s' "$1" | base64 -w 0
  printf '\n'
}

{
  b64 "$PASSPORT_SERVICE_KEY"
  b64 "cleverbrush.com"
  b64 "https://auth.cleverbrush.com"
  b64 "xpenser"
  b64 "/opt/pr-envs"
  b64 "/var/lib/pr-envs"
  b64 "3000"
  b64 "git@github.com:cleverbrush/xpenser.git"
  b64 "$PR_ENV_OTEL_EXPORTER_OTLP_ENDPOINT"
  b64 "xpenser"
  b64 "xpenser"
  b64 "xpenser"
  b64 "xpenser"
  b64 "xpenser"
  b64 "$CLOUDFLARE_API_TOKEN"
  b64 "$CLOUDFLARE_ZONE_ID"
  b64 "CNAME"
  b64 "xpenser.cleverbrush.com"
  b64 "true"
  b64 "1"
  b64 "$BRANDFETCH_API_KEY"
  b64 "$MERCHANT_ENRICHMENT_ENABLED"
  b64 "$MERCHANT_ENRICHMENT_TIMEOUT_MS"
  b64 "$OPENAI_API_KEY"
  b64 "$OPENAI_REPORT_MODEL"
  b64 "$RESEND_API_KEY"
  b64 "$EMAIL_FROM"
  b64 "$EMAIL_REPORTS_ENABLED"
  b64 "$EMAIL_REPORTS_SCHEDULER_ENABLED"
} | PR_ENV_SECRET_STREAM=1 /opt/pr-env/pr-env-proxy.sh deploy 123 <commit-sha>

# Cleanup keeps the endpoint slot empty because cleanup does not export
# telemetry, but the secret stream order must stay stable.
{
  b64 "$PASSPORT_SERVICE_KEY"
  b64 "cleverbrush.com"
  b64 "https://auth.cleverbrush.com"
  b64 "xpenser"
  b64 "/opt/pr-envs"
  b64 "/var/lib/pr-envs"
  b64 "3000"
  b64 "git@github.com:cleverbrush/xpenser.git"
  b64 ""
  b64 "xpenser"
  b64 "xpenser"
  b64 "xpenser"
  b64 "xpenser"
  b64 "xpenser"
  b64 "$CLOUDFLARE_API_TOKEN"
  b64 "$CLOUDFLARE_ZONE_ID"
  b64 "CNAME"
  b64 "xpenser.cleverbrush.com"
  b64 "true"
  b64 "1"
} | PR_ENV_SECRET_STREAM=1 /opt/pr-env/pr-env-proxy.sh cleanup 123
```

Use a real PR number and commit SHA. The deploy command should make
`https://xpenser-pr-123.cleverbrush.com` available after the containers start.
