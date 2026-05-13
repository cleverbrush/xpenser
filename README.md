# xpenser

Personal income and expense tracking app.

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
  -d '{"categoryId":1,"amount":12.34,"currency":"USD","occurredAt":"2026-05-13T12:00:00.000Z"}'
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
        occurredAt: new Date()
    }
});
```

`X-API-Key: $XPENSER_API_KEY` is also accepted. In Docker Compose, the API
service stays private on the Docker network and the Next app exposes it under
`/external-api`. Put your host reverse proxy in front of the web app:

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

## Troubleshooting

If port `5432` is already in use, change `POSTGRES_PORT` in `.env` and update
`DB_PORT` to match.

If port `3000` or `4000` is already in use, stop the conflicting process or
change the relevant app port before starting the dev servers.

If login/register fails after changing secrets or resetting data, stop the dev
server, clear browser cookies for `localhost`, and start the app again.
