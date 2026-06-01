'use client';

import { Button, Field, FieldError, FieldLabel, Input } from '@xpenser/ui';
import { type FormEvent, useId, useState } from 'react';
import { resendEmailConfirmationAction } from '@/lib/actions';
import { valuesToFormData } from './form-utils';

export function ResendEmailConfirmationForm({
    initialEmail = ''
}: {
    readonly initialEmail?: string;
}) {
    const emailId = useId();
    const [email, setEmail] = useState(initialEmail);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPending(true);
        setError(null);
        setMessage(null);

        try {
            const response = await resendEmailConfirmationAction(
                valuesToFormData({ email })
            );
            if (response && 'error' in response && response.error) {
                setError(response.error);
            } else if (response && 'message' in response && response.message) {
                setMessage(response.message);
            }
        } catch {
            setError('Could not send a confirmation link.');
        } finally {
            setPending(false);
        }
    }

    return (
        <form noValidate onSubmit={handleSubmit}>
            <Field>
                <FieldLabel htmlFor={emailId}>Email</FieldLabel>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                        autoComplete="email"
                        id={emailId}
                        onChange={event => setEmail(event.target.value)}
                        type="email"
                        value={email}
                    />
                    <Button disabled={pending} type="submit" variant="outline">
                        {pending ? 'Sending...' : 'Send link'}
                    </Button>
                </div>
                {message ? (
                    <p className="text-sm text-muted-foreground">{message}</p>
                ) : null}
                {error ? <FieldError role="alert">{error}</FieldError> : null}
            </Field>
        </form>
    );
}
