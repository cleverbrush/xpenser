'use client';

import {
    type Category,
    type Currency,
    FieldLimits,
    type Transaction,
    type TransactionScanDecisionBody,
    type TransactionScanDraft,
    type TransactionScanJobResponse,
    TransactionScanLimits,
    type TransactionScanProgressEvent,
    type TransactionScanResponse,
    type TransactionTag,
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
    SelectValue,
    Textarea
} from '@xpenser/ui';
import {
    AlertCircleIcon,
    CheckCircle2Icon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ImageUpIcon,
    PlusIcon,
    Trash2Icon
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
    type ChangeEvent,
    type DragEvent,
    type FormEvent,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
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
import { hiddenAmountLabel, useAmountPrivacy } from './amount-privacy';
import { CategoryForm } from './forms/category-form';
import { QuickCaptureForm } from './quick-capture-form';
import { TransactionTagPicker } from './transaction-tag-picker';
import { VendorPicker } from './vendor-picker';

type CaptureMode = 'manual' | 'scan';
type Decision = 'confirmed' | 'discarded';
type ScanAttachment = {
    readonly fileName?: string;
    readonly mimeType: NonNullable<
        TransactionScanDecisionBody['attachment']
    >['mimeType'];
    readonly uploadId: string;
};
type TransactionType = Category['type'];

const maxImageBytes = TransactionScanLimits.maxImageBytes;
const uploadChunkBytes = TransactionScanLimits.uploadChunkBytes;
const allowedScanImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const scanProgressPollIntervalMs = 750;
const maxScanStatusFetchFailures = 3;
const scanProgressConnectionError =
    'Could not connect to scan progress. Try again.';
const analyzingMessages = [
    'Reading visible text and totals.',
    'Matching vendors and categories.',
    'Checking whether line items should be split.',
    'Allocating shared tax, fees, and discounts.',
    'Preparing transactions for review.'
];

type ScanProgressStage =
    | TransactionScanProgressEvent['stage']
    | 'connecting'
    | 'uploading';

type ScanProgressUpdate = {
    readonly message: string;
    readonly progress: number;
    readonly stage: ScanProgressStage;
};

type ScanFileDetails = {
    readonly height?: number;
    readonly key: string;
    readonly name: string;
    readonly size: number;
    readonly width?: number;
};

type ScanResultResponse =
    | { readonly error: string; readonly scan?: undefined }
    | {
          readonly attachment: ScanAttachment;
          readonly error?: undefined;
          readonly scan: TransactionScanResponse;
      };

type ScanUploadRouteResponse =
    | { readonly error: string; readonly job?: undefined }
    | { readonly error?: undefined; readonly uploaded: true }
    | {
          readonly attachment: ScanAttachment;
          readonly error?: undefined;
          readonly job: TransactionScanJobResponse;
      };
type ScanStatusRouteResponse =
    | { readonly error: string; readonly stage?: undefined }
    | TransactionScanProgressEvent;

function blobBase64(blob: Blob): Promise<string> {
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
        reader.readAsDataURL(blob);
    });
}

function scanError(event: TransactionScanProgressEvent): string {
    return event.error ?? 'Could not scan the image. Try again.';
}

function scanEventProgress(event: TransactionScanProgressEvent): number {
    return Math.min(100, Math.round(40 + event.progress * 0.6));
}

function fileKey(file: File): string {
    return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatFileSize(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function readImageDimensions(
    file: File
): Promise<{ readonly height: number; readonly width: number } | null> {
    return new Promise(resolve => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({
                height: image.naturalHeight,
                width: image.naturalWidth
            });
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
        };
        image.src = objectUrl;
    });
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, ms));
}

function scanStatusUrl(job: TransactionScanJobResponse): string {
    const url = new URL(
        '/app-api/transaction-scans/jobs/status',
        window.location.href
    );
    url.searchParams.set('jobId', job.jobId);
    url.searchParams.set('token', job.token);
    return url.toString();
}

function scanStatusEvent(
    value: ScanStatusRouteResponse | null
): TransactionScanProgressEvent | undefined {
    return value && 'stage' in value && value.stage ? value : undefined;
}

async function fetchScanJobStatus(
    job: TransactionScanJobResponse
): Promise<TransactionScanProgressEvent> {
    const response = await fetch(scanStatusUrl(job), {
        headers: { Accept: 'application/json' }
    });
    const result = (await response
        .json()
        .catch(() => null)) as ScanStatusRouteResponse | null;
    const event = scanStatusEvent(result);

    if (!response.ok || !event) {
        throw new Error(scanProgressConnectionError);
    }

    return event;
}

async function waitForScanJob(
    job: TransactionScanJobResponse,
    onProgress: (update: ScanProgressUpdate) => void
): Promise<TransactionScanResponse> {
    let fetchFailures = 0;

    for (;;) {
        let event: TransactionScanProgressEvent;
        try {
            event = await fetchScanJobStatus(job);
            fetchFailures = 0;
        } catch {
            fetchFailures += 1;
            if (fetchFailures >= maxScanStatusFetchFailures) {
                throw new Error(scanProgressConnectionError);
            }
            await sleep(scanProgressPollIntervalMs);
            continue;
        }

        onProgress({
            message: event.message,
            progress: scanEventProgress(event),
            stage: event.stage
        });
        if (event.stage === 'failed') {
            throw new Error(scanError(event));
        }
        if (event.stage === 'complete') {
            if (event.scan) {
                return event.scan;
            }
            throw new Error(scanProgressConnectionError);
        }

        await sleep(scanProgressPollIntervalMs);
    }
}

async function uploadAndScanImageFile(
    file: File,
    onProgress: (update: ScanProgressUpdate) => void
): Promise<ScanResultResponse> {
    const uploadId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / uploadChunkBytes);
    onProgress({
        message: 'Uploading image.',
        progress: 4,
        stage: 'uploading'
    });

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        const start = chunkIndex * uploadChunkBytes;
        const response = await fetch('/app-api/transaction-scans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chunkBase64: await blobBase64(
                    file.slice(start, start + uploadChunkBytes)
                ),
                chunkIndex,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                totalChunks,
                uploadId
            })
        });
        const result = (await response
            .json()
            .catch(() => null)) as ScanUploadRouteResponse | null;

        if (!response.ok) {
            return {
                error:
                    result?.error ??
                    (response.status === 413
                        ? 'Image must be 10 MB or smaller.'
                        : 'Could not scan the image. Try again.')
            };
        }
        if (result?.error) {
            return result;
        }
        if (result && 'attachment' in result && 'job' in result) {
            onProgress({
                message: 'Connecting to scan progress.',
                progress: 38,
                stage: 'connecting'
            });
            try {
                const scan = await waitForScanJob(result.job, onProgress);
                return { attachment: result.attachment, scan };
            } catch (err) {
                return {
                    error:
                        err instanceof Error
                            ? err.message
                            : 'Could not scan the image. Try again.'
                };
            }
        }
        onProgress({
            message: `Uploading image (${Math.round(
                ((chunkIndex + 1) / totalChunks) * 100
            )}%).`,
            progress: Math.max(
                4,
                Math.round(((chunkIndex + 1) / totalChunks) * 35)
            ),
            stage: 'uploading'
        });
    }

    return { error: 'Could not scan the image. Try again.' };
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

function savedSummary(
    transaction: Transaction,
    timezone: string,
    hideAmounts: boolean
) {
    const vendor = transaction.vendorName ? `${transaction.vendorName} - ` : '';
    const amount = hideAmounts
        ? hiddenAmountLabel
        : formatTransactionMoney(
              transaction.amount,
              transaction.currency,
              transaction.type,
              transaction.categoryKind
          );
    return `${vendor}${transaction.categoryDisplayName} - ${amount} - ${formatDateTime(transaction.occurredAt, timezone)}`;
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
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [fileDetails, setFileDetails] = useState<ScanFileDetails | null>(
        null
    );
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<ScanProgressUpdate | null>(null);
    const [analysisTick, setAnalysisTick] = useState(0);

    useEffect(() => {
        if (progress?.stage !== 'analyzing') {
            return;
        }
        const timer = window.setInterval(
            () => setAnalysisTick(value => value + 1),
            5_000
        );
        return () => window.clearInterval(timer);
    }, [progress?.stage]);

    function setNextProgress(update: ScanProgressUpdate) {
        setProgress(current => {
            if (current?.stage !== update.stage) {
                setAnalysisTick(0);
            }
            return update;
        });
    }

    async function scanSelectedFile(file: File) {
        const key = fileKey(file);
        setFileDetails({
            key,
            name: file.name,
            size: file.size
        });
        setError(null);
        setProgress(null);
        void readImageDimensions(file).then(dimensions => {
            if (!dimensions) {
                return;
            }
            setFileDetails(current =>
                current?.key === key
                    ? {
                          ...current,
                          height: dimensions.height,
                          width: dimensions.width
                      }
                    : current
            );
        });

        if (!allowedScanImageTypes.includes(file.type)) {
            setError('Upload a PNG, JPEG, or WebP image.');
            if (inputRef.current) {
                inputRef.current.value = '';
            }
            return;
        }
        if (file.size > maxImageBytes) {
            setError('Image must be 10 MB or smaller.');
            if (inputRef.current) {
                inputRef.current.value = '';
            }
            return;
        }

        setPending(true);
        try {
            const result = await uploadAndScanImageFile(file, setNextProgress);
            if (result.error) {
                setError(result.error);
                return;
            }
            if (!('attachment' in result)) {
                setError('Could not scan the image. Try again.');
                return;
            }
            onScanned(result.scan, result.attachment);
            setProgress(null);
        } catch {
            setError('Could not scan the image. Try again.');
        } finally {
            setPending(false);
            if (inputRef.current) {
                inputRef.current.value = '';
            }
        }
    }

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const selected = event.target.files?.[0];
        if (selected) {
            void scanSelectedFile(selected);
        }
    }

    function handleDrop(event: DragEvent<HTMLLabelElement>) {
        event.preventDefault();
        if (pending) {
            return;
        }
        const selected = event.dataTransfer.files?.[0];
        if (selected) {
            void scanSelectedFile(selected);
        }
    }

    const displayProgress =
        progress?.stage === 'analyzing'
            ? Math.min(82, progress.progress + analysisTick * 6)
            : (progress?.progress ?? 0);
    const displayMessage =
        progress?.stage === 'analyzing'
            ? analyzingMessages[analysisTick % analyzingMessages.length]
            : progress?.message;

    return (
        <Card>
            <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col gap-4">
                    <FieldLabel
                        className={`flex cursor-pointer flex-col items-center gap-3 rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center transition-colors ${
                            pending
                                ? 'pointer-events-none opacity-70'
                                : 'hover:border-primary'
                        }`}
                        htmlFor="scan-image"
                        onDragOver={event => event.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <Input
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            disabled={pending}
                            id="scan-image"
                            onChange={handleFileChange}
                            ref={inputRef}
                            type="file"
                        />
                        <span className="flex size-11 items-center justify-center rounded-full border bg-background">
                            <ImageUpIcon aria-hidden className="size-5" />
                        </span>
                        <span>
                            {fileDetails
                                ? 'Choose another image'
                                : 'Choose image'}
                        </span>
                    </FieldLabel>
                    {fileDetails ? (
                        <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                            <p className="truncate text-foreground">
                                {fileDetails.name}
                            </p>
                            <p>
                                {formatFileSize(fileDetails.size)}
                                {fileDetails.width && fileDetails.height
                                    ? ` - ${fileDetails.width}x${fileDetails.height}`
                                    : ''}
                            </p>
                        </div>
                    ) : null}
                    {error ? (
                        <FieldError role="alert">{error}</FieldError>
                    ) : null}
                    {pending && progress && displayMessage ? (
                        <div
                            aria-live="polite"
                            className="rounded-md border px-3 py-3 text-sm text-muted-foreground"
                        >
                            <div
                                aria-label="Scan progress"
                                aria-valuemax={100}
                                aria-valuemin={0}
                                aria-valuenow={displayProgress}
                                className="mb-2 h-2 overflow-hidden rounded-full bg-muted"
                                role="progressbar"
                            >
                                <div
                                    className="h-full rounded-full bg-primary transition-all duration-700"
                                    style={{ width: `${displayProgress}%` }}
                                />
                            </div>
                            {displayMessage}
                        </div>
                    ) : null}
                </div>
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
    transactionTags,
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
    readonly transactionTags: readonly TransactionTag[];
    readonly transactionCurrencies: readonly string[];
    readonly vendors: readonly Vendor[];
}) {
    const router = useRouter();
    const { hideAmounts } = useAmountPrivacy();
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
    const [selectedTags, setSelectedTags] = useState<readonly string[]>([]);
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
        setSelectedTags([]);
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
        for (const tag of selectedTags) {
            formData.append('tags', tag);
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
                        note: note.trim() || null,
                        tags: [...selectedTags]
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

                        <TransactionTagPicker
                            tags={transactionTags}
                            selectedTags={selectedTags}
                            onChange={setSelectedTags}
                        />

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
                            <Textarea
                                autoComplete="off"
                                id="scan-note"
                                maxLength={FieldLimits.transactionNote}
                                onChange={event => setNote(event.target.value)}
                                rows={5}
                                value={note}
                            />
                        </Field>

                        {lastSaved ? (
                            <div className="rounded-md border px-3 py-2 text-sm">
                                <p className="font-medium">Saved</p>
                                <p className="truncate text-muted-foreground">
                                    {savedSummary(
                                        lastSaved,
                                        timezone,
                                        hideAmounts
                                    )}
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
    transactionTags,
    transactionCurrencies,
    vendors
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly timezone: string;
    readonly transactionTags: readonly TransactionTag[];
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
                    transactionTags={transactionTags}
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
                    transactionTags={transactionTags}
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
