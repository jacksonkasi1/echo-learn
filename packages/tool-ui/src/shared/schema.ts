import { z } from "zod";

/**
 * Action variant types for response actions
 */
export const ActionVariantSchema = z.enum([
  "default",
  "secondary",
  "ghost",
  "destructive",
  "outline",
]);

export type ActionVariant = z.infer<typeof ActionVariantSchema>;

/**
 * Serializable action schema - can be sent over the wire
 */
export const SerializableActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  variant: ActionVariantSchema.optional().default("default"),
  confirmLabel: z.string().optional(),
  disabled: z.boolean().optional(),
  loading: z.boolean().optional(),
  shortcut: z.string().optional(),
});

export type SerializableAction = z.infer<typeof SerializableActionSchema>;

/**
 * Actions configuration schema
 */
export const ActionsConfigSchema = z.object({
  items: z.array(SerializableActionSchema),
  align: z.enum(["left", "right", "center"]).optional().default("right"),
  confirmTimeout: z.number().optional().default(3000),
});

export type ActionsConfig = z.infer<typeof ActionsConfigSchema>;

/**
 * Response actions can be an array or config object
 */
export const ResponseActionsSchema = z.union([
  z.array(SerializableActionSchema),
  ActionsConfigSchema,
]);

export type ResponseActions = z.infer<typeof ResponseActionsSchema>;

/**
 * Receipt outcome types
 */
export const ReceiptOutcomeSchema = z.enum([
  "success",
  "partial",
  "failed",
  "cancelled",
]);

export type ReceiptOutcome = z.infer<typeof ReceiptOutcomeSchema>;

/**
 * Receipt schema for action confirmations
 */
export const ReceiptSchema = z.object({
  outcome: ReceiptOutcomeSchema,
  summary: z.string(),
  identifiers: z.record(z.string(), z.string()).optional(),
  at: z.string(), // ISO timestamp
});

export type Receipt = z.infer<typeof ReceiptSchema>;

/**
 * Tool UI role types
 */
export const ToolUIRoleSchema = z.enum([
  "information",
  "decision",
  "control",
  "state",
  "composite",
]);

export type ToolUIRole = z.infer<typeof ToolUIRoleSchema>;

/**
 * Base schema for all Tool UI components
 */
export const BaseToolUISchema = z.object({
  id: z.string(),
  role: ToolUIRoleSchema.optional(),
  responseActions: ResponseActionsSchema.optional(),
  receipt: ReceiptSchema.optional(),
});

export type BaseToolUI = z.infer<typeof BaseToolUISchema>;

/**
 * Normalize response actions to ActionsConfig format
 */
export function normalizeResponseActions(
  actions: ResponseActions | undefined
): ActionsConfig | undefined {
  if (!actions) return undefined;

  if (Array.isArray(actions)) {
    return {
      items: actions,
      align: "right",
      confirmTimeout: 3000,
    };
  }

  return actions;
}

/**
 * Parse and validate schema with error handling
 */
export function parseSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fallback?: T
): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  if (fallback !== undefined) {
    console.warn("Schema validation failed, using fallback:", result.error);
    return fallback;
  }

  throw new Error(`Schema validation failed: ${result.error.message}`);
}
