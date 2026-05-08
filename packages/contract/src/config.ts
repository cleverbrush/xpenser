import { env, parseEnv } from '@cleverbrush/env';
import { string, number } from '@cleverbrush/schema';

/** Application configuration parsed from environment variables with runtime validation. */
export const config = parseEnv(
  {
    db: {
      /** Database hostname */
      host: env('DB_HOST', string().default('localhost')),
      /** Database port */
      port: env('DB_PORT', number().coerce().default(5432)),
      /** Database name */
      name: env('DB_NAME', string().default('xpenser_db')),
      /** Database user */
      user: env('DB_USER', string().default('xpenser_user')),
      /** Database password */
      password: env('DB_PASSWORD', string().default('xpenser_secret')),
    },
    jwt: {
      /** JWT signing secret (minimum 32 characters) */
      secret: env('JWT_SECRET', string().minLength(32)),
      /** JWT token lifetime in seconds (default 1 hour) */
      expiresInSeconds: env('JWT_EXPIRES_IN', number().coerce().default(3600)),
    },
    google: {
      /** Google OAuth client ID */
      clientId: env('GOOGLE_CLIENT_ID', string().optional()),
    },
    server: {
      /** API server port */
      apiPort: env('API_PORT', number().coerce().default(3001)),
      /** API server host */
      apiHost: env('API_HOST', string().default('0.0.0.0')),
      /** Web server port */
      webPort: env('WEB_PORT', number().coerce().default(3000)),
    },
    /** Application log level */
    logLevel: env('LOG_LEVEL', string().default('info')),
    /** Node.js environment */
    nodeEnv: env('NODE_ENV', string().default('production')),
    otel: {
      /** OpenTelemetry collector endpoint */
      endpoint: env('OTEL_EXPORTER_OTLP_ENDPOINT', string().default('http://localhost:4318')),
      /** OpenTelemetry service name */
      serviceName: env('OTEL_SERVICE_NAME', string().default('xpenser-api')),
    },
    frankfurter: {
      /** Frankfurter API base URL for currency exchange rates */
      apiUrl: env('FRANKFURTER_API_URL', string().default('https://api.frankfurter.dev')),
    },
  },
  (base) => ({
    db: {
      /** Computed PostgreSQL connection string */
      connectionString: `postgresql://${base.db.user}:${base.db.password}@${base.db.host}:${base.db.port}/${base.db.name}`,
    },
  }),
);

/** Inferred type of the parsed configuration object. */
export type Config = typeof config;
