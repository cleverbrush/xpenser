'use client';

import { useSchemaForm } from '@cleverbrush/react-form';
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
    toast
} from '@xpenser/ui';
import { MessageSquareTextIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { SchemaField } from '@/components/forms/schema-fields';
import { submitFeedbackAction } from '@/lib/feedback-action';
import {
    FeedbackFormSchema,
    FeedbackTextMaxLength
} from '@/lib/feedback-schema';
import { isNextRedirectError, valuesToFormData } from './forms/form-utils';

export function FeedbackDialog({
    compact = false
}: {
    readonly compact?: boolean;
}) {
    const form = useSchemaForm(FeedbackFormSchema);
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const { submitting: pending, error } = form;

    function resetForm() {
        form.reset({ text: '', type: 'feedback' });
    }

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        resetForm();
    }

    const handleSubmit = form.handleSubmit(
        async values => {
            const formData = valuesToFormData(values);
            formData.set('path', pathname);
            const result = await submitFeedbackAction(formData);
            if ('error' in result)
                return {
                    ok: false,
                    error:
                        result.error ??
                        'Could not send feedback. Please try again.'
                };
            return { ok: true };
        },
        {
            onSuccess: () => {
                handleOpenChange(false);
                toast.success('Thanks — your feedback was sent.');
            },
            onError: caught => {
                if (isNextRedirectError(caught)) throw caught;
                return 'Could not send feedback. Please try again.';
            }
        }
    );

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
                    <MessageSquareTextIcon
                        aria-hidden
                        data-icon="inline-start"
                    />
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
                            fieldProps={{
                                disabled: pending,
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
                                ]
                            }}
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
