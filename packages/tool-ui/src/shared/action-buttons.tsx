"use client";

import * as React from "react";
import { cn } from "./utils";
import type {
  SerializableAction,
  ResponseActions,
  ActionVariant,
} from "./schema";
import { normalizeResponseActions } from "./schema";

/**
 * Action with optional React elements (icon, etc.)
 */
export interface Action extends SerializableAction {
  icon?: React.ReactNode;
}

/**
 * Props for ActionButtons component
 */
export interface ActionButtonsProps {
  actions?: ResponseActions;
  onAction?: (actionId: string) => void;
  onBeforeAction?: (actionId: string) => boolean | Promise<boolean>;
  disabled?: boolean;
  className?: string;
}

/**
 * Individual button props
 */
interface ActionButtonProps {
  action: Action;
  onClick: () => void;
  disabled?: boolean;
  isConfirming?: boolean;
  confirmTimeLeft?: number;
}

/**
 * Button variant styles
 */
const buttonVariants: Record<ActionVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
  outline:
    "border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm",
};

/**
 * Single action button component
 */
function ActionButton({
  action,
  onClick,
  disabled,
  isConfirming,
  confirmTimeLeft,
}: ActionButtonProps) {
  const variant = action.variant ?? "default";
  const showConfirmLabel = isConfirming && action.confirmLabel;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || action.disabled || action.loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        isConfirming && "ring-2 ring-ring ring-offset-2",
      )}
      aria-label={action.label}
    >
      {action.loading && (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {!action.loading && action.icon}
      <span>{showConfirmLabel ? action.confirmLabel : action.label}</span>
      {isConfirming && confirmTimeLeft !== undefined && (
        <span className="ml-1 text-xs opacity-70">
          ({Math.ceil(confirmTimeLeft / 1000)}s)
        </span>
      )}
      {action.shortcut && !isConfirming && (
        <kbd className="ml-2 hidden rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground sm:inline-block">
          {action.shortcut}
        </kbd>
      )}
    </button>
  );
}

/**
 * ActionButtons component - renders a row of action buttons with optional confirmation
 */
export function ActionButtons({
  actions,
  onAction,
  onBeforeAction,
  disabled,
  className,
}: ActionButtonsProps) {
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [confirmTimeLeft, setConfirmTimeLeft] = React.useState<number>(0);
  const confirmTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const countdownRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const config = normalizeResponseActions(actions);
  if (!config || config.items.length === 0) return null;

  const { items, align, confirmTimeout } = config;

  // Clear timers on unmount
  React.useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handleClick = async (action: Action) => {
    // If already confirming this action, execute it
    if (confirmingId === action.id) {
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setConfirmingId(null);
      onAction?.(action.id);
      return;
    }

    // If action requires confirmation, start confirm state
    if (action.confirmLabel) {
      // Check onBeforeAction if provided
      if (onBeforeAction) {
        const shouldContinue = await onBeforeAction(action.id);
        if (!shouldContinue) return;
      }

      setConfirmingId(action.id);
      setConfirmTimeLeft(confirmTimeout);

      // Start countdown display
      countdownRef.current = setInterval(() => {
        setConfirmTimeLeft((prev) => {
          const next = prev - 100;
          return next > 0 ? next : 0;
        });
      }, 100);

      // Auto-cancel after timeout
      confirmTimeoutRef.current = setTimeout(() => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setConfirmingId(null);
        setConfirmTimeLeft(0);
      }, confirmTimeout);

      return;
    }

    // No confirmation needed, check onBeforeAction and execute
    if (onBeforeAction) {
      const shouldContinue = await onBeforeAction(action.id);
      if (!shouldContinue) return;
    }

    onAction?.(action.id);
  };

  const alignClasses: Record<string, string> = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        alignClasses[align ?? "right"],
        className,
      )}
    >
      {items.map((action: SerializableAction) => (
        <ActionButton
          key={action.id}
          action={action}
          onClick={() => handleClick(action)}
          disabled={disabled}
          isConfirming={confirmingId === action.id}
          confirmTimeLeft={
            confirmingId === action.id ? confirmTimeLeft : undefined
          }
        />
      ))}
    </div>
  );
}

/**
 * Export action button for custom usage
 */
export { ActionButton };
