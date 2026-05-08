import { string, number, object } from '@cleverbrush/schema';

export const ErrorResponseSchema = object({
  status: number(),
  message: string(),
});

export const PaginationMetadataSchema = object({
  page: number(),
  limit: number(),
  total: number(),
  totalPages: number(),
});
