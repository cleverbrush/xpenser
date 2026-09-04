'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import {
    Button,
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    FieldDescription,
    FieldError,
    FieldGroup,
    type SelectRendererFieldProps,
    toast
} from '@xpenser/ui';
import { MessageSquareTextIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { submitFeedbackAction } from '@/lib/feedback-action';
import {
    FeedbackFormSchema,
    FeedbackTextMaxLength,
    type FeedbackType
} from '@/lib/feedback-schema';
import { isNextRedirectError, valuesToFormData } from './forms/form-utils';

export function FeedbackDialog({
    compact = false
}: {
    readonly compact?: boolean;
}) {
    const form = useSchemaForm(FeedbackFormSchema);
    const pathname = usePathname();
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [type, setType] = useState<FeedbackType>('feedback');

    function resetForm() {
        form.reset({ text: '', type: 'feedback' });
        setType('feedback');
    }

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        if (!nextOpen) {
            setError(null);
            resetForm();
        }
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        form.setValue({ type });
        const result = await form.submit();
        if (!result.valid || !result.object) {
            return;
        }

        const formData = valuesToFormData(result.object);
        formData.set('path', pathname);

        setPending(true);
        try {
            const actionResult = await submitFeedbackAction(formData);
            if ('error' in actionResult) {
                setError(
                    actionResult.error ??
                        'Could not send feedback. Please try again.'
                );
                return;
            }
            handleOpenChange(false);
            toast.success('Thanks — your feedback was sent.');
        } catch (caught) {
            if (isNextRedirectError(caught)) {
                throw caught;
            }
            setError('Could not send feedback. Please try again.');
        } finally {
            setPending(false);
        }
    }

    return (
        <Dialog onOpenChange={handleOpenChange} open={open}>
            <DialogTrigger asChild>
                <Button
                    aria-label="Leave feedback"
                    size={compact ? 'icon-sm' : 'sm'}
                    title="Leave feedback"
                    type="button"
                    variant="ghost"
                >
                    <MessageSquareTextIcon aria-hidden className="size-4" />
                    {compact ? null : (
                        <span className="hidden xl:inline">Leave feedback</span>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Leave feedback</DialogTitle>
                    <DialogDescription>
                        Share feedback, request a feature, or report a bug.
                    </DialogDescription>
                </DialogHeader>
                <form noValidate onSubmit={handleSubmit}>
                    <FieldGroup>
                        <SchemaField
                            fieldProps={
                                {
                                    disabled: pending,
                                    onValueChange: (value, field) => {
                                        const nextType = value as FeedbackType;
                                        setType(nextType);
                                        field.onChange(nextType);
                                    },
                                    options: [
                                        {
                                            label: 'Feedback',
                                            value: 'feedback'
                                        },
                                        {
                                            label: 'Feature request',
                                            value: 'feature_request'
                                        },
                                        { label: 'Bug', value: 'bug' }
                                    ],
                                    value: type
                                } satisfies SelectRendererFieldProps
                            }
                            forProperty={field => field.type}
                            form={form}
                            label="Type"
                            name="feedback-type"
                            variant="select"
                        />
                        <div className="grid gap-2">
                            <SchemaField
                                fieldProps={{
                                    'aria-describedby':
                                        'feedback-text-description',
                                    disabled: pending,
                                    maxLength: FeedbackTextMaxLength,
                                    placeholder:
                                        'Tell us what happened or what would make xpenser better.',
                                    rows: 6
                                }}
                                forProperty={field => field.text}
                                form={form}
                                label="What would you like to share?"
                                name="feedback-text"
                                variant="textarea"
                            />
                            <FieldDescription id="feedback-text-description">
                                Maximum 5,000 characters.
                            </FieldDescription>
                        </div>
                        {error ? (
                            <FieldError role="alert">{error}</FieldError>
                        ) : null}
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button
                                    disabled={pending}
                                    type="button"
                                    variant="outline"
                                >
                                    Close
                                </Button>
                            </DialogClose>
                            <Button disabled={pending} type="submit">
                                {pending ? 'Sending...' : 'Send feedback'}
                            </Button>
                        </DialogFooter>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
