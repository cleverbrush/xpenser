'use client';

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
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    Textarea
} from '@xpenser/ui';
import { MessageSquareTextIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { submitFeedbackAction } from '@/lib/feedback-action';
import { isNextRedirectError } from './forms/form-utils';

type FeedbackType = 'feedback' | 'feature_request' | 'bug';

export function FeedbackDialog({
    compact = false
}: {
    readonly compact?: boolean;
}) {
    const pathname = usePathname();
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [type, setType] = useState<FeedbackType>('feedback');

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        if (!nextOpen) {
            setError(null);
            setMessage(null);
            setType('feedback');
        }
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        formData.set('type', type);
        formData.set('path', pathname);

        setPending(true);
        setError(null);
        setMessage(null);
        try {
            const result = await submitFeedbackAction(formData);
            if ('error' in result) {
                setError(
                    result.error ?? 'Could not send feedback. Please try again.'
                );
                return;
            }
            form.reset();
            setType('feedback');
            setMessage('Thanks — your feedback was sent.');
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
                        <Field>
                            <FieldLabel htmlFor="feedback-type">
                                Type
                            </FieldLabel>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={pending}
                                id="feedback-type"
                                name="type"
                                onChange={event =>
                                    setType(
                                        event.currentTarget
                                            .value as FeedbackType
                                    )
                                }
                                value={type}
                            >
                                <option value="feedback">Feedback</option>
                                <option value="feature_request">
                                    Feature request
                                </option>
                                <option value="bug">Bug</option>
                            </select>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="feedback-text">
                                What would you like to share?
                            </FieldLabel>
                            <Textarea
                                disabled={pending}
                                id="feedback-text"
                                maxLength={5_000}
                                name="text"
                                placeholder="Tell us what happened or what would make xpenser better."
                                required
                                rows={6}
                            />
                            <FieldDescription>
                                Maximum 5,000 characters.
                            </FieldDescription>
                        </Field>
                        {error ? (
                            <FieldError role="alert">{error}</FieldError>
                        ) : null}
                        {message ? (
                            <p
                                className="text-sm text-muted-foreground"
                                role="status"
                            >
                                {message}
                            </p>
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
