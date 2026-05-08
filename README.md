# Xpenser

Personal income and expense tracker built on Cleverbrush Framework v4.2.0.

## Tech Stack

- **Backend**: @cleverbrush/server (REST API with OpenAPI)
- **Frontend**: Next.js 16 + React 19 with server components
- **UI**: Tailwind CSS, Shadcn-inspired components, light/dark themes
- **Database**: PostgreSQL via Knex + @cleverbrush/orm
- **Auth**: JWT via @cleverbrush/auth, email/password + Google OAuth
- **Observability**: OpenTelemetry → SigNoz (traces, logs, metrics)
- **Currency**: Frankfurter API integration via @cleverbrush/scheduler

## Architecture

```
Monorepo (Turborepo)
├── packages/contract   Shared API contract and schemas
├── packages/ui         Shadcn component library with themes
├── apps/api            @cleverbrush/server REST API (:3001)
└── apps/web            Next.js 16 frontend (:3000)
```

Next.js server components call the API via @cleverbrush/client (server-side HTTP). The API is independently accessible for third-party consumers.

## Quick Start

### Prerequisites

- Node.js 22+
- Docker and Docker Compose
- PostgreSQL (or use Docker)

### Setup

```bash
# Clone and install
git clone <repo-url> xpenser
cd xpenser

# Copy environment config
cp .env.example .env
# Edit .env — generate a strong JWT_SECRET

# Install dependencies
npm install

# Start PostgreSQL (if not using Docker for all)
docker compose up -d postgres

# Run database migrations
cd apps/api
npm run db:run
cd ../..

# Start development servers
npm run dev
```

### Full Docker Stack

```bash
docker compose up -d
```

Starts: PostgreSQL, SigNoz (OTel collector, ClickHouse, query service, frontend), API (:3001), Web (:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build all packages |
| `npm run lint:fix` | Lint and fix all packages |
| `npm run test` | Run all tests |
| `npm run dev` | Start development servers |
| `npm run clean` | Clean build outputs |

### Database

```bash
cd apps/api
npm run db:generate -- <name>   # Generate migration
npm run db:run                   # Run migrations
npm run db:rollback              # Rollback last migration
npm run db:status               # Check migration status
```

## Project Structure

```
apps/api/src/
├── api/
│   ├── endpoints.ts      # Endpoint definitions with metadata
│   ├── handlers/         # Request handlers
│   └── mappers.ts        # Data transformation
├── db/
│   ├── schemas.ts        # ORM entity definitions
│   └── migrations/       # Knex migrations
├── di/
│   ├── tokens.ts         # DI tokens
│   └── setup.ts          # DI registration
├── services/
│   ├── auth.ts           # Password hashing, JWT, Google OAuth
│   ├── currency.ts       # Frankfurter integration
│   └── scheduler.ts      # Exchange rate cron job
├── config.ts             # Environment config
├── logger.ts             # Structured logger
├── telemetry.ts          # OpenTelemetry SDK
├── server.ts             # Server assembly
└── index.ts              # Entry point

apps/web/src/
├── app/
│   ├── login/            # Login page
│   ├── register/         # Registration page
│   └── (protected)/      # Authenticated pages
│       ├── settings/     # Categories + Preferences
│       └── transactions/ # Transaction list
├── lib/
│   ├── api-client.ts     # Server-side API client
│   ├── auth.ts           # Session management
│   └── cache.ts          # Tag-based cache invalidation
└── middleware.ts          # Auth redirect middleware
```

## API Documentation

OpenAPI spec available at `/openapi.json` when the API is running. Swagger UI accessible at port 8090 in the Docker stack.

### Endpoints

- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Email/password login
- `POST /api/auth/google` — Google OAuth login
- `GET /api/users/me` — Get current user profile
- `PATCH /api/users/me` — Update profile
- `GET /api/categories` — List categories
- `POST /api/categories` — Create category
- `PATCH /api/categories/:id` — Update category
- `DELETE /api/categories/:id` — Delete category (409 if has transactions)
- `GET /api/transactions` — List transactions (filterable)
- `POST /api/transactions` — Create transaction
- `PATCH /api/transactions/:id` — Update transaction
- `DELETE /api/transactions/:id` — Delete transaction
- `GET /api/dashboard/summary` — Dashboard analytics
- `GET /api/currencies` — List available currencies
- `GET /api/currencies/convert` — Convert between currencies

## Environment Variables

See `.env.example` for full reference. Key variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | Yes | localhost | PostgreSQL host |
| `DB_NAME` | Yes | xpenser_db | Database name |
| `JWT_SECRET` | Yes | — | JWT signing secret (min 32 chars) |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID |
| `NODE_ENV` | Yes | production | Environment |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | http://localhost:4318 | OTel collector |

## License

BSD 3-Clause
