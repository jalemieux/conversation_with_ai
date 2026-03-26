import { z } from 'zod'
import { TOPIC_TYPES } from './augmenter'

export const AugmentRequestSchema = z.object({
  rawInput: z.string().trim().min(1, 'rawInput is required'),
})

export const UpdateConversationSchema = z.object({
  selectedType: z.enum(TOPIC_TYPES),
  augmentedPrompt: z.string().min(1),
  models: z.array(z.string()).min(1, 'At least one model is required'),
  essayMode: z.boolean(),
  responseLength: z.enum(['brief', 'standard', 'detailed']),
})

export const RespondRequestSchema = z.object({
  conversationId: z.string().min(1),
  model: z.string().min(1),
  round: z.union([z.literal(1), z.literal(2)]),
  essayMode: z.boolean().optional(),
  responseLength: z.enum(['brief', 'standard', 'detailed']).optional(),
})
