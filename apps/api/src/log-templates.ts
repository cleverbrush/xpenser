import { number, object, parseString, string } from '@cleverbrush/schema';

export const ApiListening = parseString(
    object({ Host: string(), Port: number() }),
    $t => $t`xpenser API listening on ${t => t.Host}:${t => t.Port}`
);

export const ShutdownSignalReceived = parseString(
    object({ Signal: string() }),
    $t => $t`Received shutdown signal ${t => t.Signal}`
);

export const TransactionCreated = parseString(
    object({ TransactionId: number(), UserId: number() }),
    $t => $t`Transaction ${t => t.TransactionId} created by ${t => t.UserId}`
);

export const VendorUpdateValidationRejected = parseString(
    object({ Reason: string(), UserId: number(), VendorId: number() }),
    $t =>
        $t`Vendor ${t => t.VendorId} update rejected for ${t => t.UserId}: ${t => t.Reason}`
);

export const McpTransportError = parseString(
    object({ UserId: number() }),
    $t => $t`MCP transport error for ${t => t.UserId}`
);

export const McpToolCalled = parseString(
    object({
        ToolName: string(),
        UserId: number(),
        CredentialType: string(),
        CredentialId: string()
    }),
    $t =>
        $t`MCP tool ${t => t.ToolName} called by ${t => t.UserId} using ${t => t.CredentialType} ${t => t.CredentialId}`
);

export const FrankfurterCurrencyCatalogFallback = parseString(
    object({ Reason: string().optional(), Error: string().optional() }),
    $t => $t`Using bundled Frankfurter currency catalog fallback`
);
