import { string, number, object } from '@cleverbrush/schema';

export const CategorySchema = object({
  id: number(),
  userId: number(),
  name: string(),
  type: string(),
  createdAt: string(),
});

export const CreateCategoryBodySchema = object({
  name: string(),
  type: string(),
});

export const UpdateCategoryBodySchema = object({
  name: string(),
  type: string(),
});
