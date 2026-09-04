'use server';

import { getSessionOrRedirect } from './api';
import { webConfig } from './config';
import {
    deliverFeedback,
    FeedbackInputError,
    feedbackInputFromFormData
} from './feedback';
import { loggerFor } from './logger';

const feedbackLogger = loggerFor('Feedback');
const deliveryError = 'Could not send feedback. Please try again.';

export async function submitFeedbackAction(formData: FormData) {
    const session = await getSessionOrRedirect();
    const webhookUrl = webConfig.feedback.webhookUrl;
    if (!webhookUrl) {
        return { error: 'Feedback is not available.' } as const;
    }

    let input;
    try {
        input = feedbackInputFromFormData(formData);
    } catch (error) {
        if (error instanceof FeedbackInputError) {
            return { error: error.message } as const;
        }
        throw error;
    }

    const result = await deliverFeedback({
        appUrl: webConfig.appUrl,
        environment: webConfig.nodeEnv,
        input,
        user: {
            id: session.user.id,
            email: session.user.email
        },
        webhookUrl
    });

    if (!result.ok) {
        feedbackLogger.warn('Feedback webhook delivery failed', {
            FeedbackType: input.type,
            FailureReason: result.reason,
            HttpStatus: result.status
        });
        return { error: deliveryError } as const;
    }

    feedbackLogger.info('Feedback webhook delivered', {
        FeedbackType: input.type,
        HttpStatus: result.status
    });
    return { success: true } as const;
}
