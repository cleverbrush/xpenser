#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const DEFAULT_BASE_URL = 'https://xpenser.cleverbrush.com/external-api';
export const DEFAULT_TRANSACTIONS_FILE = '/root/transactions.csv';
export const DEFAULT_CATEGORIES_FILE = '/root/categories.txt';
export const API_KEY_PLACEHOLDER = '';
export const DEFAULT_REQUEST_DELAY_MS = 250;
export const DEFAULT_RETRIES = 5;
export const DEFAULT_RETRY_BASE_DELAY_MS = 1000;
export const DEFAULT_PROGRESS_EVERY = 25;

const MAX_RETRY_DELAY_MS = 30_000;

function usage() {
    return `Usage: node scripts/import-transactions.mjs [options]

Options:
  --dry-run                       Validate and summarize without inserting
  --newest-first                  Import newest rows first (default)
  --oldest-first                  Import oldest rows first
  --start-row <row>               Resume at a 1-based CSV row
  --limit <count>                 Import at most this many rows
  --delay-ms <ms>                 Delay between transaction creates (default: ${DEFAULT_REQUEST_DELAY_MS})
  --retries <count>               Retry transient request failures (default: ${DEFAULT_RETRIES})
  --retry-base-ms <ms>            Base retry backoff delay (default: ${DEFAULT_RETRY_BASE_DELAY_MS})
  --progress-every <count>        Progress log interval for non-TTY output (default: ${DEFAULT_PROGRESS_EVERY})
  --base-url <url>                API base URL (default: ${DEFAULT_BASE_URL})
  --transactions-file <path>      CSV path (default: ${DEFAULT_TRANSACTIONS_FILE})
  --categories-file <path>        Categories path (default: ${DEFAULT_CATEGORIES_FILE})
  --help                          Show this help

Environment:
  XPENSER_API_KEY                 API key used as Bearer token
  XPENSER_BASE_URL                Optional API base URL override
  XPENSER_IMPORT_DELAY_MS         Optional delay override
  XPENSER_IMPORT_RETRIES          Optional retry count override
  XPENSER_IMPORT_RETRY_BASE_MS    Optional retry backoff override
`;
}

function positiveInteger(value, name) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${name} must be a positive integer.`);
    }
    return parsed;
}

function nonNegativeInteger(value, name) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`${name} must be a non-negative integer.`);
    }
    return parsed;
}

function optionalNonNegativeEnv(name, fallback) {
    const value = process.env[name];
    return value === undefined || value === ''
        ? fallback
        : nonNegativeInteger(value, name);
}

export function parseArgs(args) {
    const options = {
        apiKey: process.env.XPENSER_API_KEY ?? API_KEY_PLACEHOLDER,
        baseUrl: process.env.XPENSER_BASE_URL ?? DEFAULT_BASE_URL,
        categoriesFile: DEFAULT_CATEGORIES_FILE,
        delayMs: optionalNonNegativeEnv(
            'XPENSER_IMPORT_DELAY_MS',
            DEFAULT_REQUEST_DELAY_MS
        ),
        dryRun: false,
        limit: undefined,
        order: 'desc',
        progressEvery: DEFAULT_PROGRESS_EVERY,
        retries: optionalNonNegativeEnv(
            'XPENSER_IMPORT_RETRIES',
            DEFAULT_RETRIES
        ),
        retryBaseMs: optionalNonNegativeEnv(
            'XPENSER_IMPORT_RETRY_BASE_MS',
            DEFAULT_RETRY_BASE_DELAY_MS
        ),
        startRow: undefined,
        transactionsFile: DEFAULT_TRANSACTIONS_FILE
    };

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--newest-first') {
            options.order = 'desc';
        } else if (arg === '--oldest-first') {
            options.order = 'asc';
        } else if (arg === '--help') {
            options.help = true;
        } else if (arg === '--start-row') {
            options.startRow = positiveInteger(args[++index], '--start-row');
        } else if (arg === '--limit') {
            options.limit = positiveInteger(args[++index], '--limit');
        } else if (arg === '--delay-ms') {
            options.delayMs = nonNegativeInteger(args[++index], '--delay-ms');
        } else if (arg === '--retries') {
            options.retries = nonNegativeInteger(args[++index], '--retries');
        } else if (arg === '--retry-base-ms') {
            options.retryBaseMs = nonNegativeInteger(
                args[++index],
                '--retry-base-ms'
            );
        } else if (arg === '--progress-every') {
            options.progressEvery = positiveInteger(
                args[++index],
                '--progress-every'
            );
        } else if (arg === '--base-url') {
            options.baseUrl = args[++index];
        } else if (arg === '--transactions-file') {
            options.transactionsFile = args[++index];
        } else if (arg === '--categories-file') {
            options.categoriesFile = args[++index];
        } else {
            throw new Error(`Unknown option: ${arg}`);
        }
    }

    if (!options.baseUrl) {
        throw new Error('API base URL is required.');
    }
    if (!options.transactionsFile) {
        throw new Error('Transactions file is required.');
    }
    if (!options.categoriesFile) {
        throw new Error('Categories file is required.');
    }

    return options;
}

export function parseCsvLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') {
            if (inQuotes && line[index + 1] === '"') {
                current += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            fields.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    if (inQuotes) {
        throw new Error('CSV row has an unclosed quote.');
    }

    fields.push(current);
    return fields;
}

export function parseCategoryTypes(text) {
    const categories = new Map();
    const lines = text
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    for (const line of lines) {
        const separator = line.lastIndexOf(' - ');
        if (separator <= 0) {
            throw new Error(`Invalid category line: ${line}`);
        }

        const name = line.slice(0, separator);
        const type = line.slice(separator + 3);
        if (type !== 'expense' && type !== 'income') {
            throw new Error(`Invalid category type for ${name}: ${type}`);
        }
        if (categories.has(name)) {
            throw new Error(`Duplicate category in file: ${name}`);
        }
        categories.set(name, type);
    }

    return categories;
}

function parsePositiveNumber(value, name, rowNumber) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Row ${rowNumber}: ${name} must be positive.`);
    }
    return parsed;
}

function parseSignedAmount(value, rowNumber) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Row ${rowNumber}: amount must be numeric.`);
    }
    return parsed;
}

function parseTimestamp(value, rowNumber) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Row ${rowNumber}: timestamp is invalid.`);
    }
    return date.toISOString();
}

function normalizeCurrency(value, rowNumber) {
    const currency = value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
        throw new Error(`Row ${rowNumber}: currency code is invalid.`);
    }
    return currency;
}

export function effectForSignedAmount(categoryType, signedAmount) {
    return (categoryType === 'expense' && signedAmount < 0) ||
        (categoryType === 'income' && signedAmount > 0)
        ? 'reversal'
        : 'normal';
}

export function parseTransactionRow(line, rowNumber, categoryTypes) {
    const normalizedLine =
        rowNumber === 1 ? line.replace(/^\uFEFF/, '') : line;
    const fields = parseCsvLine(normalizedLine);
    if (fields.length < 5) {
        throw new Error(`Row ${rowNumber}: expected at least 5 columns.`);
    }

    const [
        timestampText,
        categoryNameText,
        amountText,
        exchangeRateText,
        currencyText,
        ...noteFields
    ] = fields;
    const categoryName = categoryNameText.trim();
    const categoryType = categoryTypes.get(categoryName);
    if (!categoryType) {
        throw new Error(`Row ${rowNumber}: unknown category ${categoryName}.`);
    }

    const signedAmount = parseSignedAmount(amountText, rowNumber);
    const exchangeRateToUsd = parsePositiveNumber(
        exchangeRateText,
        'exchange rate',
        rowNumber
    );
    const note = noteFields.join(',').trim();

    return {
        rowNumber,
        timestamp: parseTimestamp(timestampText, rowNumber),
        categoryName,
        categoryType,
        signedAmount,
        amount: Math.abs(signedAmount),
        exchangeRateToUsd,
        currency: normalizeCurrency(currencyText, rowNumber),
        effect:
            signedAmount === 0
                ? 'normal'
                : effectForSignedAmount(categoryType, signedAmount),
        skipReason: signedAmount === 0 ? 'zero_amount' : undefined,
        note: note === '' ? undefined : note
    };
}

export function summarizeRows(rows) {
    const summary = {
        total: rows.length,
        importable: 0,
        skipped: 0,
        normal: 0,
        reversal: 0,
        currencies: new Map(),
        categories: new Map(),
        skipReasons: new Map()
    };

    for (const row of rows) {
        if (row.skipReason) {
            summary.skipped += 1;
            summary.skipReasons.set(
                row.skipReason,
                (summary.skipReasons.get(row.skipReason) ?? 0) + 1
            );
        } else {
            summary.importable += 1;
            summary[row.effect] += 1;
        }
        summary.currencies.set(
            row.currency,
            (summary.currencies.get(row.currency) ?? 0) + 1
        );
        summary.categories.set(
            row.categoryName,
            (summary.categories.get(row.categoryName) ?? 0) + 1
        );
    }

    return summary;
}

function sortedObject(map) {
    return Object.fromEntries([...map.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
    ));
}

function printSummary(label, rows) {
    const summary = summarizeRows(rows);
    console.log(`${label}: ${summary.total}`);
    console.log(`  importable: ${summary.importable}`);
    console.log(`  skipped: ${summary.skipped}`);
    console.log(`  normal: ${summary.normal}`);
    console.log(`  reversal: ${summary.reversal}`);
    if (summary.skipped > 0) {
        console.log(
            `  skip reasons: ${JSON.stringify(sortedObject(summary.skipReasons))}`
        );
    }
    console.log(
        `  currencies: ${JSON.stringify(sortedObject(summary.currencies))}`
    );
    console.log(`  categories: ${summary.categories.size}`);
}

async function readTransactions(path, categoryTypes) {
    const text = await readFile(path, 'utf8');
    return text
        .split(/\r?\n/)
        .filter(line => line.trim() !== '')
        .map((line, index) =>
            parseTransactionRow(line, index + 1, categoryTypes)
        );
}

function apiUrl(baseUrl, path) {
    return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export class ApiRequestError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'ApiRequestError';
        this.status = details.status;
        this.method = details.method;
        this.path = details.path;
        this.retryAfterMs = details.retryAfterMs;
        this.responseBody = details.responseBody;
        this.cause = details.cause;
    }
}

export function isRetryableStatus(status) {
    return (
        status === undefined ||
        status === 408 ||
        status === 429 ||
        (status >= 500 && status <= 599)
    );
}

export function retryDelayMs(retryAttempt, baseDelayMs, retryAfterMs) {
    if (retryAfterMs !== undefined) {
        return Math.min(Math.max(0, retryAfterMs), MAX_RETRY_DELAY_MS);
    }

    return Math.min(
        baseDelayMs * 2 ** Math.max(0, retryAttempt - 1),
        MAX_RETRY_DELAY_MS
    );
}

function parseRetryAfterMs(value) {
    if (!value) {
        return undefined;
    }

    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.ceil(seconds * 1000);
    }

    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
        return undefined;
    }

    return Math.max(0, timestamp - Date.now());
}

function responseErrorMessage(method, path, status, text, body) {
    if (body && typeof body === 'object') {
        const message =
            'message' in body
                ? body.message
                : 'detail' in body
                  ? body.detail
                  : undefined;
        const details =
            'errors' in body ? ` ${JSON.stringify(body.errors)}` : '';

        if (message) {
            return `${method} ${path} failed with ${status}: ${message}${details}`;
        }
    }

    return `${method} ${path} failed with ${status}: ${text}`;
}

async function apiRequestOnce(options, path, request = {}) {
    const method = request.method ?? 'GET';
    let response;

    try {
        response = await fetch(apiUrl(options.baseUrl, path), {
            method,
            headers: {
                Authorization: `Bearer ${options.apiKey}`,
                'Content-Type': 'application/json'
            },
            body:
                request.body === undefined
                    ? undefined
                    : JSON.stringify(request.body)
        });
    } catch (err) {
        throw new ApiRequestError(
            `${method} ${path} failed before receiving a response: ${
                err instanceof Error ? err.message : String(err)
            }`,
            { cause: err, method, path }
        );
    }

    const text = await response.text();
    let body;
    try {
        body = text ? JSON.parse(text) : undefined;
    } catch {
        body = text;
    }

    if (!response.ok) {
        throw new ApiRequestError(
            responseErrorMessage(method, path, response.status, text, body),
            {
                method,
                path,
                responseBody: body,
                retryAfterMs: parseRetryAfterMs(
                    response.headers.get('retry-after')
                ),
                status: response.status
            }
        );
    }

    return body;
}

function sleep(ms) {
    if (ms <= 0) {
        return Promise.resolve();
    }

    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) {
        return `${seconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours === 0) {
        return `${minutes}m ${seconds}s`;
    }

    return `${hours}h ${remainingMinutes}m`;
}

async function apiRequest(options, path, request = {}) {
    const retries = options.retries ?? DEFAULT_RETRIES;

    for (let attempt = 0; ; attempt += 1) {
        try {
            return await apiRequestOnce(options, path, request);
        } catch (err) {
            if (
                !(err instanceof ApiRequestError) ||
                attempt >= retries ||
                !isRetryableStatus(err.status)
            ) {
                throw err;
            }

            const retryAttempt = attempt + 1;
            const delayMs = retryDelayMs(
                retryAttempt,
                options.retryBaseMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
                err.retryAfterMs
            );
            console.warn(
                `${err.message} Retrying in ${formatDuration(delayMs)} (${retryAttempt}/${retries}).`
            );
            await sleep(delayMs);
        }
    }
}

function categoryMapFromApi(categories) {
    const byName = new Map();
    for (const category of categories) {
        if (byName.has(category.name)) {
            throw new Error(`Duplicate category in Xpenser: ${category.name}`);
        }
        byName.set(category.name, category);
    }
    return byName;
}

function validateAgainstApi(rows, categoryTypes, categoriesByName) {
    const errors = [];

    for (const [name, type] of categoryTypes) {
        const category = categoriesByName.get(name);
        if (!category) {
            errors.push(`Missing Xpenser category: ${name}`);
        } else if (category.type !== type) {
            errors.push(
                `Xpenser category type mismatch for ${name}: expected ${type}, got ${category.type}`
            );
        }
    }

    for (const row of rows) {
        const category = categoriesByName.get(row.categoryName);
        if (!category) {
            errors.push(
                `Row ${row.rowNumber}: missing Xpenser category ${row.categoryName}`
            );
        } else if (category.type !== row.categoryType) {
            errors.push(
                `Row ${row.rowNumber}: Xpenser category ${row.categoryName} has type ${category.type}, expected ${row.categoryType}`
            );
        }
    }

    if (errors.length > 0) {
        throw new Error(
            `Import validation failed:\n${errors
                .slice(0, 20)
                .map(error => `- ${error}`)
                .join('\n')}${errors.length > 20 ? `\n- ...and ${errors.length - 20} more` : ''}`
        );
    }
}

function maxRowNumber(rows) {
    return rows.reduce(
        (currentMax, row) => Math.max(currentMax, row.rowNumber),
        0
    );
}

export function selectRows(rows, options = {}) {
    const order = options.order ?? 'desc';
    if (order !== 'asc' && order !== 'desc') {
        throw new Error(`Unsupported import order: ${order}`);
    }

    const resolvedStartRow =
        options.startRow ?? (order === 'desc' ? maxRowNumber(rows) : 1);
    const selected = rows
        .filter(row =>
            order === 'desc'
                ? row.rowNumber <= resolvedStartRow
                : row.rowNumber >= resolvedStartRow
        )
        .sort((left, right) =>
            order === 'desc'
                ? right.rowNumber - left.rowNumber
                : left.rowNumber - right.rowNumber
        );

    return options.limit === undefined
        ? selected
        : selected.slice(0, options.limit);
}

function transactionBody(row, categoriesByName) {
    if (row.skipReason) {
        throw new Error(`Row ${row.rowNumber}: skipped rows cannot be inserted.`);
    }

    const category = categoriesByName.get(row.categoryName);
    if (!category) {
        throw new Error(`Row ${row.rowNumber}: category disappeared.`);
    }

    const body = {
        categoryId: category.id,
        amount: row.amount,
        currency: row.currency,
        effect: row.effect,
        occurredAt: row.timestamp
    };
    if (row.note) {
        body.note = row.note;
    }
    return body;
}

export function progressLine(inserted, total, rowNumber, startedAtMs, nowMs) {
    const elapsedMs = Math.max(0, nowMs - startedAtMs);
    const percent = total === 0 ? 100 : (inserted / total) * 100;
    const rate = elapsedMs === 0 ? 0 : inserted / (elapsedMs / 1000);
    const etaMs =
        inserted === 0 || rate === 0
            ? undefined
            : ((total - inserted) / rate) * 1000;

    return [
        `Inserted ${inserted}/${total} (${percent.toFixed(1)}%)`,
        `CSV row ${rowNumber}`,
        `${formatDuration(elapsedMs)} elapsed`,
        `ETA ${etaMs === undefined ? '--' : formatDuration(etaMs)}`,
        `${rate.toFixed(1)} rows/s`
    ].join(' | ');
}

function createProgressReporter(total, options) {
    const startedAtMs = Date.now();
    const progressEvery = options.progressEvery ?? DEFAULT_PROGRESS_EVERY;
    const isTty = process.stdout.isTTY === true;
    let lastLineLength = 0;

    return {
        finish() {
            if (isTty && lastLineLength > 0) {
                process.stdout.write('\n');
            }
        },
        tick(row, inserted) {
            const line = progressLine(
                inserted,
                total,
                row.rowNumber,
                startedAtMs,
                Date.now()
            );

            if (isTty) {
                const padded = line.padEnd(lastLineLength, ' ');
                process.stdout.write(`\r${padded}`);
                lastLineLength = padded.length;
            } else if (inserted % progressEvery === 0 || inserted === total) {
                console.log(line);
            }
        }
    };
}

function resumeHint(options, rowNumber) {
    return options.order === 'asc'
        ? `--oldest-first --start-row ${rowNumber}`
        : `--start-row ${rowNumber}`;
}

async function importRows(rows, options, categoriesByName) {
    if (rows.length === 0) {
        return;
    }

    const progress = createProgressReporter(rows.length, options);
    let inserted = 0;

    try {
        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index];
            try {
                await apiRequest(options, 'transactions', {
                    method: 'POST',
                    body: transactionBody(row, categoriesByName)
                });
            } catch (err) {
                throw new Error(
                    `Import stopped at row ${row.rowNumber}. Resume with ${resumeHint(options, row.rowNumber)}. ${err.message}`
                );
            }

            inserted += 1;
            progress.tick(row, inserted);

            if (index < rows.length - 1) {
                await sleep(options.delayMs ?? DEFAULT_REQUEST_DELAY_MS);
            }
        }
    } finally {
        progress.finish();
    }
}

export async function main(argv = process.argv.slice(2)) {
    const options = parseArgs(argv);
    if (options.help) {
        console.log(usage());
        return;
    }

    if (!options.apiKey) {
        throw new Error(
            'Set XPENSER_API_KEY or replace API_KEY_PLACEHOLDER in the script before importing.'
        );
    }

    const categoryTypes = parseCategoryTypes(
        await readFile(options.categoriesFile, 'utf8')
    );
    const rows = await readTransactions(options.transactionsFile, categoryTypes);
    if (
        options.startRow !== undefined &&
        options.startRow > maxRowNumber(rows)
    ) {
        throw new Error(
            `--start-row ${options.startRow} is past the last CSV row (${maxRowNumber(rows)}).`
        );
    }

    const categories = await apiRequest(options, 'categories');
    const categoriesByName = categoryMapFromApi(categories);
    validateAgainstApi(rows, categoryTypes, categoriesByName);

    const selectedRows = selectRows(rows, options);
    const importableRows = selectedRows.filter(row => !row.skipReason);
    printSummary('Validated rows', rows);
    printSummary('Selected rows', selectedRows);
    if (selectedRows.length > 0) {
        const firstRow = selectedRows[0].rowNumber;
        const lastRow = selectedRows[selectedRows.length - 1].rowNumber;
        console.log(
            `Import order: ${options.order === 'desc' ? 'newest first' : 'oldest first'} (CSV row ${firstRow} to ${lastRow}).`
        );
        console.log(
            `Request pacing: ${options.delayMs}ms delay, ${options.retries} retries, ${options.retryBaseMs}ms retry base.`
        );
    }

    if (options.dryRun) {
        console.log('Dry run complete. No transactions were inserted.');
        return;
    }

    await importRows(importableRows, options, categoriesByName);
    console.log(
        `Import complete. Inserted ${importableRows.length} transactions.`
    );
    if (selectedRows.length !== importableRows.length) {
        console.log(
            `Skipped ${selectedRows.length - importableRows.length} zero-amount rows that the current API cannot create.`
        );
    }
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    main().catch(err => {
        console.error(err.message);
        process.exitCode = 1;
    });
}
