import { z } from "zod";
import { BaseToolUISchema, ResponseActionsSchema } from "../shared/schema";

/**
 * Todo item status
 */
export const TodoStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

export type TodoStatus = z.infer<typeof TodoStatusSchema>;

/**
 * Todo item schema
 */
export const TodoItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: TodoStatusSchema,
  description: z.string().optional(),
});

export type TodoItem = z.infer<typeof TodoItemSchema>;

/**
 * Serializable Plan schema - can be sent over the wire from backend
 */
export const SerializablePlanSchema = BaseToolUISchema.extend({
  title: z.string(),
  description: z.string().optional(),
  todos: z.array(TodoItemSchema),
  maxVisibleTodos: z.number().optional().default(5),
  showProgress: z.boolean().optional().default(true),
  responseActions: ResponseActionsSchema.optional(),
});

export type SerializablePlan = z.infer<typeof SerializablePlanSchema>;

/**
 * Parse and validate serializable plan data
 */
export function parseSerializablePlan(data: unknown): SerializablePlan {
  return SerializablePlanSchema.parse(data);
}

/**
 * Safe parse that returns null on failure
 */
export function safeParseSerializablePlan(
  data: unknown
): SerializablePlan | null {
  const result = SerializablePlanSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Calculate plan progress statistics
 */
export function calculatePlanProgress(todos: TodoItem[]): {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  cancelled: number;
  percentComplete: number;
} {
  const total = todos.length;
  const completed = todos.filter((t) => t.status === "completed").length;
  const inProgress = todos.filter((t) => t.status === "in_progress").length;
  const pending = todos.filter((t) => t.status === "pending").length;
  const cancelled = todos.filter((t) => t.status === "cancelled").length;

  // Don't count cancelled items in progress calculation
  const activeTotal = total - cancelled;
  const percentComplete =
    activeTotal > 0 ? Math.round((completed / activeTotal) * 100) : 0;

  return {
    total,
    completed,
    inProgress,
    pending,
    cancelled,
    percentComplete,
  };
}

/**
 * Check if all todos are complete
 */
export function isPlanComplete(todos: TodoItem[]): boolean {
  return todos.every(
    (t) => t.status === "completed" || t.status === "cancelled"
  );
}

/**
 * Get the current/active todo (first in_progress or first pending)
 */
export function getCurrentTodo(todos: TodoItem[]): TodoItem | null {
  return (
    todos.find((t) => t.status === "in_progress") ??
    todos.find((t) => t.status === "pending") ??
    null
  );
}
