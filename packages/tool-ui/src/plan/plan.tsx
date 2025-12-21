"use client";

import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import {
  Check,
  Circle,
  Loader2,
  X,
  ChevronDown,
  PartyPopper,
} from "lucide-react";

import { cn } from "../shared/utils";
import { ActionButtons } from "../shared/action-buttons";
import type { ResponseActions } from "../shared/schema";
import {
  type TodoItem,
  type TodoStatus,
  calculatePlanProgress,
  isPlanComplete,
} from "./schema";

/**
 * Props for the Plan component
 */
export interface PlanProps {
  /** Unique identifier for this plan */
  id: string;
  /** Plan title */
  title: string;
  /** Optional description */
  description?: string;
  /** Todo items */
  todos: TodoItem[];
  /** Maximum visible todos before collapsing */
  maxVisibleTodos?: number;
  /** Whether to show progress bar */
  showProgress?: boolean;
  /** Response action buttons configuration */
  responseActions?: ResponseActions;
  /** Additional CSS classes */
  className?: string;
  /** Callback for response actions */
  onResponseAction?: (actionId: string) => void;
  /** Callback before response action (return false to cancel) */
  onBeforeResponseAction?: (actionId: string) => boolean | Promise<boolean>;
}

/**
 * Status icon component
 */
function StatusIcon({ status }: { status: TodoStatus }) {
  switch (status) {
    case "completed":
      return (
        <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="size-3" />
        </div>
      );
    case "in_progress":
      return (
        <div className="flex size-5 items-center justify-center">
          <Loader2 className="size-4 animate-spin text-primary" />
        </div>
      );
    case "cancelled":
      return (
        <div className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <X className="size-3" />
        </div>
      );
    case "pending":
    default:
      return (
        <div className="flex size-5 items-center justify-center">
          <Circle className="size-4 text-muted-foreground/50" />
        </div>
      );
  }
}

/**
 * Single todo item component
 */
function TodoItemRow({
  todo,
  isExpanded,
  onToggle,
}: {
  todo: TodoItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasDescription = !!todo.description;

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 py-2",
        todo.status === "cancelled" && "opacity-50"
      )}
    >
      <StatusIcon status={todo.status} />
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm leading-tight",
            todo.status === "completed" && "text-muted-foreground",
            todo.status === "cancelled" && "line-through text-muted-foreground",
            todo.status === "in_progress" && "font-medium"
          )}
        >
          {todo.label}
        </span>
        {hasDescription && isExpanded && (
          <p className="mt-1 text-xs text-muted-foreground">
            {todo.description}
          </p>
        )}
      </div>
      {hasDescription && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex size-6 items-center justify-center rounded hover:bg-accent"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </button>
      )}
    </div>
  );

  return content;
}

/**
 * Progress bar component
 */
function ProgressBar({
  completed,
  total,
  percentComplete,
}: {
  completed: number;
  total: number;
  percentComplete: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {completed} of {total} complete
        </span>
        <span className="font-medium">{percentComplete}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            percentComplete === 100 ? "bg-emerald-500" : "bg-primary"
          )}
          style={{ width: `${percentComplete}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Celebration component for completed plans
 */
function CompletionCelebration() {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-emerald-700 dark:text-emerald-300">
      <PartyPopper className="size-4" />
      <span className="text-sm font-medium">All complete!</span>
    </div>
  );
}

/**
 * Plan component - displays a structured plan with progress tracking
 */
export function Plan({
  id,
  title,
  description,
  todos,
  maxVisibleTodos = 5,
  showProgress = true,
  responseActions,
  className,
  onResponseAction,
  onBeforeResponseAction,
}: PlanProps) {
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(
    new Set()
  );
  const [isCollapsedOpen, setIsCollapsedOpen] = React.useState(false);

  const progress = calculatePlanProgress(todos);
  const isComplete = isPlanComplete(todos);

  // Split todos into visible and collapsed
  const visibleTodos = todos.slice(0, maxVisibleTodos);
  const collapsedTodos = todos.slice(maxVisibleTodos);
  const hasCollapsed = collapsedTodos.length > 0;

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-2xl border bg-card p-4 shadow-sm",
        className
      )}
      data-tool-ui="plan"
      data-plan-id={id}
    >
      {/* Header */}
      <div className="mb-3">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div className="mb-4">
          <ProgressBar
            completed={progress.completed}
            total={progress.total - progress.cancelled}
            percentComplete={progress.percentComplete}
          />
        </div>
      )}

      {/* Celebration if complete */}
      {isComplete && <CompletionCelebration />}

      {/* Todo list */}
      {!isComplete && (
        <div className="space-y-1">
          {/* Visible todos */}
          {visibleTodos.map((todo) => (
            <TodoItemRow
              key={todo.id}
              todo={todo}
              isExpanded={expandedItems.has(todo.id)}
              onToggle={() => toggleItemExpanded(todo.id)}
            />
          ))}

          {/* Collapsed section */}
          {hasCollapsed && (
            <CollapsiblePrimitive.Root
              open={isCollapsedOpen}
              onOpenChange={setIsCollapsedOpen}
            >
              <CollapsiblePrimitive.Trigger className="flex w-full items-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground">
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    isCollapsedOpen && "rotate-180"
                  )}
                />
                <span>
                  {collapsedTodos.length} more
                </span>
              </CollapsiblePrimitive.Trigger>

              <CollapsiblePrimitive.Content className="space-y-1 overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                {collapsedTodos.map((todo) => (
                  <TodoItemRow
                    key={todo.id}
                    todo={todo}
                    isExpanded={expandedItems.has(todo.id)}
                    onToggle={() => toggleItemExpanded(todo.id)}
                  />
                ))}
              </CollapsiblePrimitive.Content>
            </CollapsiblePrimitive.Root>
          )}
        </div>
      )}

      {/* Response actions */}
      {responseActions && (
        <div className="mt-4 border-t pt-4">
          <ActionButtons
            actions={responseActions}
            onAction={onResponseAction}
            onBeforeAction={onBeforeResponseAction}
          />
        </div>
      )}
    </div>
  );
}
