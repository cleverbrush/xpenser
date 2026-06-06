# xpenser

Personal income and expense tracking app.

xpenser also serves as a demonstrator for projects based on CleverBrush
Framework. See
[Cleverbrush Reference Notes](./docs/cleverbrush-reference.md) for the
framework integration patterns, security baseline, and tests that keep the app
usable as an example.

## Local Development

This setup runs the API and web app on your machine, with PostgreSQL running in
Docker.

### Prerequisites

- Node.js 22
- npm
- Docker with Docker Compose v2 (`docker compose`)

### 1. Install dependencies

```sh
npm install
```

### 2. Create a local environment file

```sh
cp .env.example .env
```

The defaults in `.env.example` are already set up for local development with
PostgreSQL exposed on `localhost:5432`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=xpenser
DB_USER=xpenser
DB_PASSWORD=xpenser_secret
```

### 3. Build the shared workspaces

The apps import the local packages from their built `dist` outputs, so build the
shared packages once before starting dev servers:

```sh
npm run build -w @xpenser/contracts
npm run build -w @xpenser/client
npm run build -w @xpenser/ui
```

### 4. Start PostgreSQL

Start only the Postgres service from `docker-compose.yml`:

```sh
docker compose up -d postgres
```

Check that it is running:

```sh
docker compose ps postgres
docker compose logs postgres
```

### 5. Start the app

```sh
npm run dev
```

The API runs database migrations on startup.

Local URLs:

- Web app: http://localhost:3000
- API: http://localhost:4000
- API health check: http://localhost:4000/health
- OpenAPI JSON: http://localhost:4000/openapi.json

### Authentication

Email/password sign-in is built in and works without any external auth provider.
Accounts created this way must confirm their email before signing in.

Google sign-in has two supported modes:

- Direct Google OAuth for self-hosted deployments.
- Cleverbrush Passport for the hosted Cleverbrush deployment.

Select the mode with `GOOGLE_SIGN_IN_MODE`:

```env
GOOGLE_SIGN_IN_MODE=auto
```

`auto` uses direct Google OAuth when `AUTH_GOOGLE_ID` and
`AUTH_GOOGLE_SECRET` are configured. If those are not set, it uses Passport only
when all Passport variables are configured. If neither auth provider is
configured, the Google sign-in button is hidden and email/password sign-in still
works.

Use `GOOGLE_SIGN_IN_MODE=direct` to require direct Google OAuth,
`GOOGLE_SIGN_IN_MODE=passport` to require Passport, or
`GOOGLE_SIGN_IN_MODE=disabled` to hide Google sign-in even when credentials are
present.

#### Direct Google OAuth for self-hosting

Create an OAuth 2.0 client in Google Cloud Console:

- Application type: Web application
- Authorized JavaScript origin: your public `APP_URL`
- Authorized redirect URI: `${APP_URL}/api/auth/callback/google`

For local development with the default `APP_URL`, use:

```text
http://localhost:3000/api/auth/callback/google
```

Configure the web app with Auth.js-standard Google variables:

```env
APP_URL=https://xpenser.example.com
NEXTAUTH_URL=https://xpenser.example.com
NEXTAUTH_SECRET=replace-with-at-least-32-characters
AUTH_SECRET=replace-with-the-same-value-as-NEXTAUTH_SECRET
GOOGLE_SIGN_IN_MODE=auto
AUTH_GOOGLE_ID=your-google-oauth-client-id
AUTH_GOOGLE_SECRET=your-google-oauth-client-secret
```

The web app validates the Google profile through Auth.js, then calls the private
xpenser API with `WEB_API_SERVICE_SECRET`. The API resolves or creates a local
`google` user, stores the Google subject in `external_identities`, and returns
the same xpenser API JWT used by email/password sessions.

Google accounts must have a verified email address. If a local email/password
account already exists with the same email, Google sign-in is rejected instead of
silently linking the accounts.

#### Passport for Cleverbrush deployment

Passport is a private Cleverbrush auth broker. Self-hosted deployments should
use direct Google OAuth unless they run their own compatible Passport service.

Configure both services with:

```env
GOOGLE_SIGN_IN_MODE=passport
PASSPORT_BASE_URL=https://auth.cleverbrush.com
PASSPORT_PROJECT=xpenser
PASSPORT_ENVIRONMENT=production
PASSPORT_PUBLIC_KEY=
```

`PASSPORT_PUBLIC_KEY` is optional. When it is empty, the API fetches
`<PASSPORT_BASE_URL>/.well-known/public-key` and caches it in memory. If set, use
the base64-encoded PEM public key.

Register the production Passport environment with:

```sh
curl -X PUT "$PASSPORT_BASE_URL/api/projects/xpenser/environments/production" \
  -H "Authorization: ServiceKey $PASSPORT_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "frontend_origin": "https://xpenser.cleverbrush.com",
    "callback_path": "/auth/callback",
    "backend_auth_url": "https://xpenser.cleverbrush.com/external-api/auth/passport",
    "status": "active"
  }'
```

To see distributed traces during local development, run the Compose observability
services or the full Docker stack so `OTEL_EXPORTER_OTLP_ENDPOINT` points at a
live collector. The web app reports as `xpenser-web`; the API reports as
`xpenser-api`.

## Database Commands

Run migrations manually if needed:

```sh
npm run db:run -w @xpenser/api
```

Stop Postgres without deleting data:

```sh
docker compose stop postgres
```

Stop Compose services and remove containers/networks:

```sh
docker compose down
```

Reset the local database by removing the Postgres volume:

```sh
docker compose down -v
docker compose up -d postgres
```

## Full Docker Run

For a production-like local run, build and start the Compose stack:

```sh
docker compose up --build
```

This starts the containerized web app, API, PostgreSQL, Swagger UI, and the
observability services defined in `docker-compose.yml`. Requests that start in
the web app and call the API should appear in SigNoz as one distributed trace
with spans from both services.

Full Docker URLs:

- Web app: http://localhost:3000
- External API proxy: http://localhost:3000/external-api
- Swagger UI: http://localhost:8090
- SigNoz: http://localhost:8080

## External API Access

Create an API key from Settings -> Preferences -> API keys. The API key can be
used as a bearer token with curl or with the typed Node client:

```sh
curl -X POST "$APP_URL/external-api/transactions" \
  -H "Authorization: Bearer $XPENSER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"categoryId":1,"amount":12.34,"currency":"USD","effect":"normal","occurredAt":"2026-05-13T12:00:00.000Z"}'
```

```ts
import { createXpenserClient } from '@xpenser/client';

const client = createXpenserClient({
    baseUrl:
        process.env.XPENSER_API_BASE_URL ??
        'http://localhost:3000/external-api',
    getToken: () => process.env.XPENSER_API_KEY ?? null
});

await client.transactions.create({
    body: {
        categoryId: 1,
        amount: 12.34,
        currency: 'USD',
        effect: 'normal',
        occurredAt: new Date()
    }
});
```

Omit `effect` or set it to `normal` for regular transactions. Use
`effect: 'reversal'` for refunds in expense categories or payments/chargebacks
in income categories; the entered amount stays positive and reports subtract it
from that category.

`X-API-Key: $XPENSER_API_KEY` is also accepted.

## MCP Server

xpenser also exposes a read-only MCP Streamable HTTP endpoint for AI agents at
`/external-api/mcp`. Use the same API key from Settings -> Preferences -> API
keys as a bearer token:

```json
{
  "mcpServers": {
    "xpenser": {
      "type": "streamable-http",
      "url": "https://xpenser.example.com/external-api/mcp",
      "headers": {
        "Authorization": "Bearer ${XPENSER_API_KEY}"
      }
    }
  }
}
```

The MCP server exposes read-only tools for the current user, categories,
transactions, dashboard summaries, and statistics. Transaction write operations
are not exposed through MCP.

In Docker Compose, the API service stays private on the Docker network and the
Next app exposes it under `/external-api`. Put your host reverse proxy in front
of the web app:

```nginx
server {
    server_name xpenser.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Set `APP_URL` to the public web origin. The API's OpenAPI server URL defaults to
`${APP_URL}/external-api` in Compose and can be overridden with
`PUBLIC_API_BASE_URL`.

## Ephemeral PR Environments

See [PR_ENVIRONMENTS.md](./PR_ENVIRONMENTS.md) for the nginx proxy script,
environment deploy script, and GitHub Actions setup.

## Troubleshooting

If port `5432` is already in use, change `POSTGRES_PORT` in `.env` and update
`DB_PORT` to match.

If port `3000` or `4000` is already in use, stop the conflicting process or
change the relevant app port before starting the dev servers.

If login/register fails after changing secrets or resetting data, stop the dev
server, clear browser cookies for `localhost`, and start the app again.

If the Google sign-in button is hidden, either set `AUTH_GOOGLE_ID` and
`AUTH_GOOGLE_SECRET` for direct Google OAuth, set complete Passport variables
with `GOOGLE_SIGN_IN_MODE=passport`, or set `GOOGLE_SIGN_IN_MODE=direct` to fail
fast when Google credentials are missing.

If Google returns a redirect URI mismatch, add the exact
`${APP_URL}/api/auth/callback/google` URL to the Google OAuth client. The scheme,
host, port, and path must match the public URL users open in the browser.
