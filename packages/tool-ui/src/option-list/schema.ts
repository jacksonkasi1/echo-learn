import { z } from "zod";
import { BaseToolUISchema, ResponseActionsSchema } from "../shared/schema";

/**
 * Option item schema
 */
export const OptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
});

export type Option = z.infer<typeof OptionSchema>;

/**
 * Selection mode for the option list
 */
export const SelectionModeSchema = z.enum(["single", "multi"]);

export type SelectionMode = z.infer<typeof SelectionModeSchema>;

/**
 * Selection value type - single string or array of strings
 */
export const SelectionValueSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.null(),
]);

export type SelectionValue = z.infer<typeof SelectionValueSchema>;

/**
 * Selection result returned on confirm
 */
export const OptionListSelectionSchema = z.object({
  selectedIds: z.array(z.string()),
  selectedLabels: z.array(z.string()),
});

export type OptionListSelection = z.infer<typeof OptionListSelectionSchema>;

/**
 * Serializable OptionList schema - can be sent over the wire from backend
 */
export const SerializableOptionListSchema = BaseToolUISchema.extend({
  options: z.array(OptionSchema),
  selectionMode: SelectionModeSchema.optional().default("single"),
  title: z.string().optional(),
  description: z.string().optional(),
  minSelections: z.number().optional(),
  maxSelections: z.number().optional(),
  defaultValue: SelectionValueSchema.optional(),
  responseActions: ResponseActionsSchema.optional(),
});

export type SerializableOptionList = z.infer<
  typeof SerializableOptionListSchema
>;

/**
 * Parse and validate serializable option list data
 */
export function parseSerializableOptionList(
  data: unknown,
): SerializableOptionList {
  return SerializableOptionListSchema.parse(data);
}

/**
 * Safe parse that returns null on failure
 */
export function safeParseSerializableOptionList(
  data: unknown,
): SerializableOptionList | null {
  const result = SerializableOptionListSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Normalize selection value to array format
 */
export function normalizeSelectionValue(
  value: SelectionValue | undefined,
): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

/**
 * Create selection result from selected IDs and options
 */
export function createSelectionResult(
  selectedIds: string[],
  options: Option[],
): OptionListSelection {
  const selectedLabels = selectedIds
    .map((id) => options.find((opt) => opt.id === id)?.label)
    .filter((label): label is string => label !== undefined);

  return {
    selectedIds,
    selectedLabels,
  };
}
