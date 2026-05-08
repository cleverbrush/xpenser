import { number, object, parseString, string } from '@cleverbrush/schema';

export const AppStarting = parseString(
  object({ Environment: string() }),
  ($t) => $t`Starting application in ${(t) => t.Environment} mode`,
);

export const MigrationsRunning = parseString(
  object({}),
  ($t) => $t`Running database migrations…`,
);

export const MigrationsComplete = parseString(
  object({}),
  ($t) => $t`Migrations complete`,
);

export const Listening = parseString(
  object({ Host: string(), Port: number() }),
  ($t) => $t`Listening on http://${(t) => t.Host}:${(t) => t.Port}`,
);

export const OpenApiSpec = parseString(
  object({ Host: string(), Port: number() }),
  ($t) => $t`OpenAPI spec → http://${(t) => t.Host}:${(t) => t.Port}/openapi.json`,
);

export const ShutdownReceived = parseString(
  object({ Signal: string() }),
  ($t) => $t`Received ${(t) => t.Signal}, shutting down…`,
);

export const HttpServerClosed = parseString(
  object({}),
  ($t) => $t`HTTP server closed`,
);

export const UserRegistered = parseString(
  object({ Email: string(), UserId: number() }),
  ($t) => $t`User registered: ${(t) => t.Email} (ID ${(t) => t.UserId})`,
);

export const UserLoggedIn = parseString(
  object({ UserId: number() }),
  ($t) => $t`User logged in: ID ${(t) => t.UserId}`,
);

export const TransactionCreated = parseString(
  object({ TransactionId: number(), UserId: number(), Amount: number() }),
  ($t) =>
    $t`Transaction ${(t) => t.TransactionId} created by user ${(t) => t.UserId}: ${(t) => t.Amount}`,
);

export const CategoryCreated = parseString(
  object({ CategoryId: number(), Name: string() }),
  ($t) => $t`Category created: ${(t) => t.Name} (ID ${(t) => t.CategoryId})`,
);

export const CategoryDeleted = parseString(
  object({ CategoryId: number(), Name: string() }),
  ($t) => $t`Category deleted: ${(t) => t.Name} (ID ${(t) => t.CategoryId})`,
);

export const ExchangeRatesUpdated = parseString(
  object({ BaseCurrency: string(), Count: number() }),
  ($t) =>
    $t`Exchange rates updated for ${(t) => t.BaseCurrency}: ${(t) => t.Count} rates`,
);
