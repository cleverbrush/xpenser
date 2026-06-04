'use client';

import {
    type Category,
    type Currency,
    type Transaction,
    type TransactionScanDecisionBody,
    type TransactionScanDraft,
    TransactionScanLimits,
    type TransactionScanResponse,
    type Vendor
} from '@xpenser/contracts';
import {
    dateToLocalDateTimeInput,
    localDateTimeInputToDate
} from '@xpenser/timezone';
import {
    Button,
    Card,
    CardContent,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@xpenser/ui';
import {
    AlertCircleIcon,
    CheckCircle2Icon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ImageUpIcon,
    PlusIcon,
    ScanLineIcon,
    Trash2Icon
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useState } from 'react';
import {
    createCaptureTransactionAction,
    createVendorAction,
    recordTransactionScanDecisionAction
} from '@/lib/actions';
import {
    categoryEffectiveType,
    categoryTypeLabel,
    transactionCategoryOptions
} from '@/lib/category-display';
import { formatDateTime, formatTransactionMoney } from '@/lib/format';
import { transactionCurrencyOptions } from '@/lib/transaction-currencies';
import { CategoryForm } from './forms/category-form';
import { QuickCaptureForm } from './quick-capture-form';
import { VendorPicker } from './vendor-picker';

type CaptureMode = 'manual' | 'scan';
type Decision = 'confirmed' | 'discarded';
type ScanAttachment = NonNullable<TransactionScanDecisionBody['attachment']>;
type TransactionType = Category['type'];

const maxImageBytes = TransactionScanLimits.maxImageBytes;

type ScanRouteResponse =
    | { readonly error: string; readonly scan?: undefined }
    | { readonly error?: undefined; readonly scan: TransactionScanResponse };

function fileImageBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read image.'));
        reader.onload = () => {
            const value = reader.result;
            if (typeof value !== 'string') {
                reject(new Error('Could not read image.'));
                return;
            }
            const commaIndex = value.indexOf(',');
            resolve(commaIndex >= 0 ? value.slice(commaIndex + 1) : value);
        };
        reader.readAsDataURL(file);
    });
}

async function scanImageFile(file: File): Promise<ScanRouteResponse> {
    const formData = new FormData();
    formData.set('image', file);

    const response = await fetch('/api/transaction-scans', {
        method: 'POST',
        body: formData
    });
    const result = (await response
        .json()
        .catch(() => null)) as ScanRouteResponse | null;

    if (!response.ok) {
        return {
            error:
                result?.error ??
                (response.status === 413
                    ? 'Image must be 10 MB or smaller.'
                    : 'Could not scan the image. Try again.')
        };
    }

    return result ?? { error: 'Could not scan the image. Try again.' };
}

function parseAmount(value: string): number | undefined {
    const normalized = value.trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
        return undefined;
    }

    const amount = Number(normalized);
    return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

function firstCategoryId(
    categories: readonly Category[],
    type: TransactionType
): number | undefined {
    return categories.find(category => categoryEffectiveType(category) === type)
        ?.id;
}

function draftCategoryType(
    draft: TransactionScanDraft,
    categories: readonly Category[]
): TransactionType {
    const category = categories.find(item => item.id === draft.categoryId);
    return category ? categoryEffectiveType(category) : draft.transactionType;
}

function initialValues({
    categories,
    defaultCurrency,
    draft,
    timezone
}: {
    readonly categories: readonly Category[];
    readonly defaultCurrency: string;
    readonly draft: TransactionScanDraft;
    readonly timezone: string;
}) {
    const type = draftCategoryType(draft, categories);
    return {
        amount: draft.amount ? String(draft.amount) : '',
        categoryId: draft.categoryId ?? undefined,
        currency: draft.currency ?? defaultCurrency,
        occurredAtText: dateToLocalDateTimeInput(
            draft.occurredAt ?? new Date(),
            timezone
        ),
        note: draft.note ?? '',
        type,
        vendorId: draft.vendorId
    };
}

function confidenceLabel(value: string): string {
    return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function savedSummary(transaction: Transaction, timezone: string) {
    const vendor = transaction.vendorName ? `${transaction.vendorName} - ` : '';
    return `${vendor}${transaction.categoryDisplayName} - ${formatTransactionMoney(
        transaction.amount,
        transaction.currency,
        transaction.type,
        transaction.categoryKind
    )} - ${formatDateTime(transaction.occurredAt, timezone)}`;
}

function nextPendingIndex(
    drafts: readonly TransactionScanDraft[],
    decisions: Readonly<Record<number, Decision>>,
    currentIndex: number
): number | undefined {
    const afterCurrent = drafts.findIndex(
        (draft, index) => index > currentIndex && !decisions[draft.id]
    );
    if (afterCurrent >= 0) {
        return afterCurrent;
    }
    const beforeCurrent = drafts.findIndex(draft => !decisions[draft.id]);
    return beforeCurrent >= 0 ? beforeCurrent : undefined;
}

function ScanUpload({
    onScanned
}: {
    readonly onScanned: (
        scan: TransactionScanResponse,
        attachment: ScanAttachment
    ) => void;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!file) {
            setError('Choose an image to scan.');
            return;
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setError('Upload a PNG, JPEG, or WebP image.');
            return;
        }
        if (file.size > maxImageBytes) {
            setError('Image must be 10 MB or smaller.');
            return;
        }

        setPending(true);
        setError(null);
        try {
            const result = await scanImageFile(file);
            if (result.error) {
                setError(result.error);
                return;
            }
            if (!result.scan) {
                setError('Could not scan the image. Try again.');
                return;
            }
            onScanned(result.scan, {
                imageBase64: await fileImageBase64(file),
                mimeType: file.type as ScanAttachment['mimeType'],
                fileName: file.name
            });
        } catch {
            setError('Could not scan the image. Try again.');
        } finally {
            setPending(false);
        }
    }

    return (
        <Card>
            <CardContent className="p-4 sm:p-6">
                <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                    <Field>
                        <FieldLabel htmlFor="scan-image">
                            Invoice, receipt, or bank screenshot
                        </FieldLabel>
                        <Input
                            accept="image/png,image/jpeg,image/webp"
                            id="scan-image"
                            onChange={event =>
                                setFile(event.target.files?.[0] ?? null)
                            }
                            type="file"
                        />
                    </Field>
                    {file ? (
                        <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                            {file.name} - {(file.size / 1024 / 1024).toFixed(2)}{' '}
                            MB
                        </div>
                    ) : null}
                    {error ? (
                        <FieldError role="alert">{error}</FieldError>
                    ) : null}
                    <Button
                        className="h-12 w-full"
                        disabled={pending}
                        type="submit"
                    >
                        <ScanLineIcon aria-hidden className="size-4" />
                        {pending ? 'Scanning...' : 'Scan image'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function SuggestedVendor({
    name,
    onCreated
}: {
    readonly name: string;
    readonly onCreated: (vendor: Vendor) => void;
}) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleCreate() {
        const formData = new FormData();
        formData.set('name', name);

        setPending(true);
        setError(null);
        try {
            onCreated(await createVendorAction(formData));
        } catch {
            setError('Could not create vendor.');
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="flex flex-col gap-2 rounded-md border px-3 py-2">
            <div className="min-w-0">
                <p className="text-sm font-medium">Suggested vendor</p>
                <p className="truncate text-sm text-muted-foreground">{name}</p>
            </div>
            {error ? <FieldError role="alert">{error}</FieldError> : null}
            <Button
                className="w-full sm:w-auto"
                disabled={pending}
                onClick={handleCreate}
                size="sm"
                type="button"
                variant="outline"
            >
                <PlusIcon aria-hidden className="size-4" />
                {pending ? 'Creating...' : 'Create vendor'}
            </Button>
        </div>
    );
}

function SuggestedCategory({
    categories,
    draft,
    onCreated
}: {
    readonly categories: readonly Category[];
    readonly draft: TransactionScanDraft;
    readonly onCreated: (category: Category) => void;
}) {
    const [open, setOpen] = useState(false);
    const suggestion = draft.suggestedCategory;
    if (!suggestion) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2 rounded-md border px-3 py-2">
            <div className="min-w-0">
                <p className="text-sm font-medium">Suggested category</p>
                <p className="truncate text-sm text-muted-foreground">
                    {categoryTypeLabel(suggestion.type)} - {suggestion.name}
                </p>
                <p className="text-xs text-muted-foreground">
                    {suggestion.reason}
                </p>
            </div>
            <Dialog onOpenChange={setOpen} open={open}>
                <DialogTrigger asChild>
                    <Button
                        className="w-full sm:w-auto"
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        <PlusIcon aria-hidden className="size-4" />
                        Create category
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create category</DialogTitle>
                        <DialogDescription>
                            The new category will be selected for this scanned
                            transaction.
                        </DialogDescription>
                    </DialogHeader>
                    <CategoryForm
                        categories={categories}
                        initialValues={{
                            kind: suggestion.kind,
                            name: suggestion.name,
                            parentId: suggestion.parentId,
                            type: suggestion.type
                        }}
                        onSaved={category => {
                            if (category) {
                                onCreated(category);
                            }
                            setOpen(false);
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ScanWizard({
    attachment,
    categories,
    currencies,
    defaultCurrency,
    onReset,
    scan,
    setCategories,
    setVendors,
    timezone,
    transactionCurrencies,
    vendors
}: {
    readonly attachment: ScanAttachment;
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly onReset: () => void;
    readonly scan: TransactionScanResponse;
    readonly setCategories: (categories: readonly Category[]) => void;
    readonly setVendors: (vendors: readonly Vendor[]) => void;
    readonly timezone: string;
    readonly transactionCurrencies: readonly string[];
    readonly vendors: readonly Vendor[];
}) {
    const router = useRouter();
    const transactionCategories = useMemo(
        () => transactionCategoryOptions(categories),
        [categories]
    );
    const currencyOptions = useMemo(
        () =>
            transactionCurrencyOptions(
                currencies,
                defaultCurrency,
                transactionCurrencies
            ),
        [currencies, defaultCurrency, transactionCurrencies]
    );
    const [currentIndex, setCurrentIndex] = useState(0);
    const [decisions, setDecisions] = useState<Record<number, Decision>>({});
    const [lastSaved, setLastSaved] = useState<Transaction | null>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const draft = scan.drafts[currentIndex];
    const values = useMemo(
        () =>
            draft
                ? initialValues({
                      categories: transactionCategories,
                      defaultCurrency,
                      draft,
                      timezone
                  })
                : undefined,
        [defaultCurrency, draft, timezone, transactionCategories]
    );
    const [amount, setAmount] = useState(values?.amount ?? '');
    const [categoryId, setCategoryId] = useState<number | undefined>(
        values?.categoryId
    );
    const [currency, setCurrency] = useState(
        values?.currency ?? defaultCurrency
    );
    const [occurredAtText, setOccurredAtText] = useState(
        values?.occurredAtText ?? dateToLocalDateTimeInput(new Date(), timezone)
    );
    const [note, setNote] = useState(values?.note ?? '');
    const [selectedType, setSelectedType] = useState<TransactionType>(
        values?.type ?? 'expense'
    );
    const [vendorId, setVendorId] = useState<number | null | undefined>(
        values?.vendorId
    );
    const [createdCategoryId, setCreatedCategoryId] = useState<number | null>(
        null
    );
    const [createdVendorId, setCreatedVendorId] = useState<number | null>(null);
    const [attachmentSubmitted, setAttachmentSubmitted] = useState(false);

    function loadDraft(nextIndex: number) {
        const nextDraft = scan.drafts[nextIndex];
        if (!nextDraft) {
            return;
        }
        const next = initialValues({
            categories: transactionCategories,
            defaultCurrency,
            draft: nextDraft,
            timezone
        });
        setCurrentIndex(nextIndex);
        setAmount(next.amount);
        setCategoryId(next.categoryId);
        setCurrency(next.currency);
        setOccurredAtText(next.occurredAtText);
        setNote(next.note);
        setSelectedType(next.type);
        setVendorId(next.vendorId);
        setCreatedCategoryId(null);
        setCreatedVendorId(null);
        setError(null);
        setLastSaved(null);
    }

    function moveAfterDecision(nextDecisions: Record<number, Decision>) {
        const nextIndex = nextPendingIndex(
            scan.drafts,
            nextDecisions,
            currentIndex
        );
        if (nextIndex !== undefined) {
            loadDraft(nextIndex);
        }
    }

    function handleTypeChange(type: TransactionType) {
        setSelectedType(type);
        const current = transactionCategories.find(
            category => category.id === categoryId
        );
        if (current && categoryEffectiveType(current) === type) {
            return;
        }
        setCategoryId(firstCategoryId(transactionCategories, type));
    }

    function handleVendorChange(vendor: Vendor | undefined) {
        setVendorId(vendor?.id ?? null);
        if (!vendor?.suggestedCategoryId) {
            return;
        }
        const suggested = transactionCategories.find(
            category => category.id === vendor.suggestedCategoryId
        );
        if (!suggested) {
            return;
        }
        setSelectedType(categoryEffectiveType(suggested));
        setCategoryId(suggested.id);
    }

    function handleCategoryCreated(category: Category) {
        setCategories([
            category,
            ...categories.filter(item => item.id !== category.id)
        ]);
        setSelectedType(categoryEffectiveType(category));
        setCategoryId(category.id);
        setCreatedCategoryId(category.id);
    }

    function handleVendorCreated(vendor: Vendor) {
        setVendors([vendor, ...vendors.filter(item => item.id !== vendor.id)]);
        setVendorId(vendor.id);
        setCreatedVendorId(vendor.id);
        if (vendor.suggestedCategoryId) {
            const suggested = transactionCategories.find(
                category => category.id === vendor.suggestedCategoryId
            );
            if (suggested) {
                setSelectedType(categoryEffectiveType(suggested));
                setCategoryId(suggested.id);
            }
        }
    }

    async function handleDiscard() {
        if (!draft) {
            return;
        }
        setPending(true);
        setError(null);
        try {
            await recordTransactionScanDecisionAction({
                scanId: scan.scanId,
                itemId: draft.id,
                body: { decision: 'discarded' }
            });
            const nextDecisions = {
                ...decisions,
                [draft.id]: 'discarded' as const
            };
            setDecisions(nextDecisions);
            moveAfterDecision(nextDecisions);
        } catch {
            setError('Could not discard this scanned transaction.');
        } finally {
            setPending(false);
        }
    }

    async function handleConfirm(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!draft) {
            return;
        }

        const amountValue = parseAmount(amount);
        const occurredAt = localDateTimeInputToDate(occurredAtText, timezone);
        if (amountValue === undefined) {
            setError('Enter a positive amount with up to two decimals.');
            return;
        }
        if (!categoryId) {
            setError('Choose a category.');
            return;
        }
        if (!currency) {
            setError('Choose a currency.');
            return;
        }
        if (!occurredAt) {
            setError('Choose a valid date and time.');
            return;
        }

        const formData = new FormData();
        formData.set('amount', String(amountValue));
        formData.set('categoryId', String(categoryId));
        formData.set('currency', currency);
        formData.set('occurredAt', occurredAt.toISOString());
        if (vendorId) {
            formData.set('vendorId', String(vendorId));
        }
        if (note.trim()) {
            formData.set('note', note.trim());
        }

        setPending(true);
        setError(null);
        try {
            const transaction = await createCaptureTransactionAction(formData);
            const shouldSubmitAttachment = !attachmentSubmitted;
            await recordTransactionScanDecisionAction({
                scanId: scan.scanId,
                itemId: draft.id,
                body: {
                    decision: 'confirmed',
                    transactionId: transaction.id,
                    createdCategoryId,
                    createdVendorId,
                    correctedTransaction: {
                        amount: amountValue,
                        categoryId,
                        currency,
                        occurredAt,
                        vendorId: vendorId ?? null,
                        note: note.trim() || null
                    },
                    attachment: shouldSubmitAttachment ? attachment : undefined
                }
            });
            if (shouldSubmitAttachment) {
                setAttachmentSubmitted(true);
            }
            const nextDecisions = {
                ...decisions,
                [draft.id]: 'confirmed' as const
            };
            setDecisions(nextDecisions);
            setLastSaved(transaction);
            router.refresh();
            moveAfterDecision(nextDecisions);
        } catch {
            setError('Could not save this scanned transaction.');
        } finally {
            setPending(false);
        }
    }

    if (scan.drafts.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
                    <div>
                        <p className="text-sm font-medium">
                            No transactions found
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Try a clearer receipt, invoice, or banking
                            screenshot.
                        </p>
                    </div>
                    <Button onClick={onReset} type="button" variant="outline">
                        Scan another image
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!draft) {
        return null;
    }

    const completeCount = Object.keys(decisions).length;
    const complete = completeCount === scan.drafts.length;
    const filteredCategories = transactionCategories.filter(
        category => categoryEffectiveType(category) === selectedType
    );

    if (complete) {
        return (
            <Card>
                <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
                    <CheckCircle2Icon className="size-6 text-emerald-600" />
                    <div>
                        <p className="text-sm font-medium">Scan reviewed</p>
                        <p className="text-sm text-muted-foreground">
                            Confirmed{' '}
                            {
                                Object.values(decisions).filter(
                                    value => value === 'confirmed'
                                ).length
                            }{' '}
                            and discarded{' '}
                            {
                                Object.values(decisions).filter(
                                    value => value === 'discarded'
                                ).length
                            }
                            .
                        </p>
                    </div>
                    <Button onClick={onReset} type="button" variant="outline">
                        Scan another image
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="overflow-visible">
            <CardContent className="p-4 sm:p-6">
                <div className="mb-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium">
                                Transaction {currentIndex + 1} of{' '}
                                {scan.drafts.length}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {scan.documentKind.replace('_', ' ')}
                            </p>
                        </div>
                        <div className="flex gap-1">
                            <Button
                                aria-label="Previous scanned transaction"
                                disabled={currentIndex === 0}
                                onClick={() => loadDraft(currentIndex - 1)}
                                size="icon-sm"
                                type="button"
                                variant="outline"
                            >
                                <ChevronLeftIcon
                                    aria-hidden
                                    className="size-4"
                                />
                            </Button>
                            <Button
                                aria-label="Next scanned transaction"
                                disabled={
                                    currentIndex >= scan.drafts.length - 1
                                }
                                onClick={() => loadDraft(currentIndex + 1)}
                                size="icon-sm"
                                type="button"
                                variant="outline"
                            >
                                <ChevronRightIcon
                                    aria-hidden
                                    className="size-4"
                                />
                            </Button>
                        </div>
                    </div>
                    {scan.warnings.map(warning => (
                        <div
                            className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                            key={warning}
                        >
                            <AlertCircleIcon
                                aria-hidden
                                className="mt-0.5 size-4 shrink-0"
                            />
                            <span>{warning}</span>
                        </div>
                    ))}
                </div>

                <form
                    className="pb-20 sm:pb-0"
                    noValidate
                    onSubmit={handleConfirm}
                >
                    <FieldGroup className="gap-3 sm:gap-4">
                        <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">
                                Visible evidence
                            </p>
                            <p>
                                {draft.evidence ||
                                    'No supporting text was returned.'}
                            </p>
                            <p className="mt-1 text-xs">
                                Confidence:{' '}
                                {confidenceLabel(draft.confidence.overall)}
                            </p>
                        </div>

                        {draft.possibleDuplicateTransactionIds.length > 0 ? (
                            <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                                <AlertCircleIcon
                                    aria-hidden
                                    className="mt-0.5 size-4 shrink-0"
                                />
                                <span>
                                    Possible duplicate of transaction{' '}
                                    {draft.possibleDuplicateTransactionIds.join(
                                        ', '
                                    )}
                                    .
                                </span>
                            </div>
                        ) : null}

                        <Field>
                            <FieldLabel>Type</FieldLabel>
                            <div className="grid grid-cols-2 gap-2">
                                {(['expense', 'income'] as const).map(type => (
                                    <Button
                                        aria-pressed={selectedType === type}
                                        key={type}
                                        onClick={() => handleTypeChange(type)}
                                        type="button"
                                        variant={
                                            selectedType === type
                                                ? 'default'
                                                : 'outline'
                                        }
                                    >
                                        {categoryTypeLabel(type)}
                                    </Button>
                                ))}
                            </div>
                        </Field>

                        <Field>
                            <FieldLabel>Category</FieldLabel>
                            <Select
                                onValueChange={value =>
                                    setCategoryId(Number(value))
                                }
                                value={categoryId ? String(categoryId) : ''}
                            >
                                <SelectTrigger aria-label="Scanned transaction category">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {filteredCategories.map(category => (
                                            <SelectItem
                                                key={category.id}
                                                value={String(category.id)}
                                            >
                                                {category.displayName}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </Field>

                        {!categoryId ? (
                            <SuggestedCategory
                                categories={categories}
                                draft={draft}
                                onCreated={handleCategoryCreated}
                            />
                        ) : null}

                        <VendorPicker
                            vendors={vendors}
                            onChange={handleVendorChange}
                            selectedVendorId={vendorId}
                        />

                        {!vendorId && draft.suggestedVendorName ? (
                            <SuggestedVendor
                                name={draft.suggestedVendorName}
                                onCreated={handleVendorCreated}
                            />
                        ) : null}

                        <Field className="gap-2">
                            <FieldLabel htmlFor="scan-amount">
                                Amount
                            </FieldLabel>
                            <div className="grid grid-cols-[minmax(0,1fr)_5.25rem] gap-2">
                                <Input
                                    autoComplete="off"
                                    className="h-14 text-2xl font-semibold"
                                    id="scan-amount"
                                    inputMode="decimal"
                                    min="0.01"
                                    onChange={event =>
                                        setAmount(event.target.value)
                                    }
                                    placeholder="0.00"
                                    step="0.01"
                                    type="text"
                                    value={amount}
                                />
                                <Select
                                    onValueChange={setCurrency}
                                    value={currency}
                                >
                                    <SelectTrigger
                                        aria-label="Currency"
                                        className="h-14 w-[5.25rem] px-2 text-base font-semibold [&>svg]:size-4"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="min-w-[5.25rem]">
                                        <SelectGroup>
                                            {currencyOptions.map(option => (
                                                <SelectItem
                                                    key={option.code}
                                                    value={option.code}
                                                >
                                                    {option.code}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="scan-occurred-at">
                                Date and time
                            </FieldLabel>
                            <Input
                                id="scan-occurred-at"
                                onChange={event =>
                                    setOccurredAtText(event.target.value)
                                }
                                type="datetime-local"
                                value={occurredAtText}
                            />
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="scan-note">Note</FieldLabel>
                            <Input
                                autoComplete="off"
                                id="scan-note"
                                onChange={event => setNote(event.target.value)}
                                value={note}
                            />
                        </Field>

                        {lastSaved ? (
                            <div className="rounded-md border px-3 py-2 text-sm">
                                <p className="font-medium">Saved</p>
                                <p className="truncate text-muted-foreground">
                                    {savedSummary(lastSaved, timezone)}
                                </p>
                            </div>
                        ) : null}

                        {error ? (
                            <FieldError role="alert">{error}</FieldError>
                        ) : null}

                        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 grid grid-cols-[auto_minmax(0,1fr)] gap-2 border-t bg-background/95 px-3 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
                            <Button
                                disabled={pending}
                                onClick={handleDiscard}
                                type="button"
                                variant="outline"
                            >
                                <Trash2Icon aria-hidden className="size-4" />
                                Discard
                            </Button>
                            <Button disabled={pending} type="submit">
                                <CheckCircle2Icon
                                    aria-hidden
                                    className="size-4"
                                />
                                {pending ? 'Saving...' : 'Confirm and save'}
                            </Button>
                        </div>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}

export function TransactionCaptureWorkspace({
    categories,
    currencies,
    defaultCurrency,
    timezone,
    transactionCurrencies,
    vendors
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly timezone: string;
    readonly transactionCurrencies: readonly string[];
    readonly vendors: readonly Vendor[];
}) {
    const [mode, setMode] = useState<CaptureMode>('manual');
    const [scanSession, setScanSession] = useState<{
        readonly attachment: ScanAttachment;
        readonly scan: TransactionScanResponse;
    } | null>(null);
    const [localCategories, setLocalCategories] =
        useState<readonly Category[]>(categories);
    const [localVendors, setLocalVendors] =
        useState<readonly Vendor[]>(vendors);

    return (
        <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
                <Button
                    aria-pressed={mode === 'manual'}
                    onClick={() => setMode('manual')}
                    type="button"
                    variant={mode === 'manual' ? 'default' : 'outline'}
                >
                    <PlusIcon aria-hidden className="size-4" />
                    Manual
                </Button>
                <Button
                    aria-pressed={mode === 'scan'}
                    onClick={() => setMode('scan')}
                    type="button"
                    variant={mode === 'scan' ? 'default' : 'outline'}
                >
                    <ImageUpIcon aria-hidden className="size-4" />
                    Scan
                </Button>
            </div>

            {mode === 'manual' ? (
                <QuickCaptureForm
                    categories={localCategories}
                    currencies={currencies}
                    defaultCurrency={defaultCurrency}
                    vendors={localVendors}
                    timezone={timezone}
                    transactionCurrencies={transactionCurrencies}
                />
            ) : scanSession ? (
                <ScanWizard
                    attachment={scanSession.attachment}
                    categories={localCategories}
                    currencies={currencies}
                    defaultCurrency={defaultCurrency}
                    onReset={() => setScanSession(null)}
                    scan={scanSession.scan}
                    setCategories={setLocalCategories}
                    setVendors={setLocalVendors}
                    timezone={timezone}
                    transactionCurrencies={transactionCurrencies}
                    vendors={localVendors}
                />
            ) : (
                <ScanUpload
                    onScanned={(scan, attachment) =>
                        setScanSession({ attachment, scan })
                    }
                />
            )}
        </div>
    );
}
