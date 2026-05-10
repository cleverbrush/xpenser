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
- API: http://localhost:4000
- Swagger UI: http://localhost:8090
- SigNoz: http://localhost:8080

## Troubleshooting

If port `5432` is already in use, change `POSTGRES_PORT` in `.env` and update
`DB_PORT` to match.

If port `3000` or `4000` is already in use, stop the conflicting process or
change the relevant app port before starting the dev servers.

If login/register fails after changing secrets or resetting data, stop the dev
server, clear browser cookies for `localhost`, and start the app again.
