#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const DEFAULT_BASE_URL = 'https://xpenser.cleverbrush.com/external-api';
export const DEFAULT_TRANSACTIONS_FILE = '/root/transactions.csv';
export const DEFAULT_CATEGORIES_FILE = '/root/categories.txt';
export const API_KEY_PLACEHOLDER = '';

function usage() {
    return `Usage: node scripts/import-transactions.mjs [options]

Options:
  --dry-run                       Validate and summarize without inserting
  --start-row <row>               Start importing at a 1-based CSV row
  --limit <count>                 Import at most this many rows
  --base-url <url>                API base URL (default: ${DEFAULT_BASE_URL})
  --transactions-file <path>      CSV path (default: ${DEFAULT_TRANSACTIONS_FILE})
  --categories-file <path>        Categories path (default: ${DEFAULT_CATEGORIES_FILE})
  --help                          Show this help

Environment:
  XPENSER_API_KEY                 API key used as Bearer token
  XPENSER_BASE_URL                Optional API base URL override
`;
}

function positiveInteger(value, name) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${name} must be a positive integer.`);
    }
    return parsed;
}

export function parseArgs(args) {
    const options = {
        apiKey: process.env.XPENSER_API_KEY ?? API_KEY_PLACEHOLDER,
        baseUrl: process.env.XPENSER_BASE_URL ?? DEFAULT_BASE_URL,
        categoriesFile: DEFAULT_CATEGORIES_FILE,
        dryRun: false,
        limit: undefined,
        startRow: 1,
        transactionsFile: DEFAULT_TRANSACTIONS_FILE
    };

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--help') {
            options.help = true;
        } else if (arg === '--start-row') {
            options.startRow = positiveInteger(args[++index], '--start-row');
        } else if (arg === '--limit') {
            options.limit = positiveInteger(args[++index], '--limit');
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

async function apiRequest(options, path, request = {}) {
    const response = await fetch(apiUrl(options.baseUrl, path), {
        method: request.method ?? 'GET',
        headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json'
        },
        body:
            request.body === undefined
                ? undefined
                : JSON.stringify(request.body)
    });

    const text = await response.text();
    let body;
    try {
        body = text ? JSON.parse(text) : undefined;
    } catch {
        body = text;
    }
    if (!response.ok) {
        const message =
            body && typeof body === 'object' && 'message' in body
                ? body.message
                : text;
        throw new Error(
            `${request.method ?? 'GET'} ${path} failed with ${response.status}: ${message}`
        );
    }

    return body;
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
            errors.push(`Row ${row.rowNumber}: missing Xpenser category ${row.categoryName}`);
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

function selectRows(rows, startRow, limit) {
    const selected = rows.filter(row => row.rowNumber >= startRow);
    return limit === undefined ? selected : selected.slice(0, limit);
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

async function importRows(rows, options, categoriesByName) {
    let inserted = 0;
    for (const row of rows) {
        try {
            await apiRequest(options, 'transactions', {
                method: 'POST',
                body: transactionBody(row, categoriesByName)
            });
        } catch (err) {
            throw new Error(
                `Import stopped at row ${row.rowNumber}. Resume with --start-row ${row.rowNumber}. ${err.message}`
            );
        }

        inserted += 1;
        if (inserted % 100 === 0 || inserted === rows.length) {
            console.log(`Inserted ${inserted}/${rows.length} rows.`);
        }
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
    const categories = await apiRequest(options, 'categories');
    const categoriesByName = categoryMapFromApi(categories);
    validateAgainstApi(rows, categoryTypes, categoriesByName);

    const selectedRows = selectRows(rows, options.startRow, options.limit);
    const importableRows = selectedRows.filter(row => !row.skipReason);
    printSummary('Validated rows', rows);
    printSummary('Selected rows', selectedRows);

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
