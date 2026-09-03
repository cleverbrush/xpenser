import { enumOf, type InferType, object, string } from '@cleverbrush/schema';

export const FeedbackTypes = ['feedback', 'feature_request', 'bug'] as const;

export const FeedbackTextMaxLength = 5_000;

const invalidTypeMessage = 'Choose a valid feedback type.';
const emptyTextMessage = 'Enter your feedback before sending.';

export const FeedbackFormSchema = object({
    type: enumOf(FeedbackTypes, invalidTypeMessage)
        .required(invalidTypeMessage)
        .default('feedback'),
    text: string()
        .required(emptyTextMessage)
        .trim()
        .nonempty(emptyTextMessage)
        .maxLength(
            FeedbackTextMaxLength,
            `Feedback must be ${FeedbackTextMaxLength.toLocaleString('en')} characters or fewer.`
        )
});

export type FeedbackFormValues = InferType<typeof FeedbackFormSchema>;
export type FeedbackType = FeedbackFormValues['type'];
