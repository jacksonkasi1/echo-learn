"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Circle } from "lucide-react";

import { cn } from "../shared/utils";
import { ActionButtons } from "../shared/action-buttons";
import type { ResponseActions } from "../shared/schema";
import {
  type Option,
  type SelectionMode,
  type SelectionValue,
  type OptionListSelection,
  normalizeSelectionValue,
  createSelectionResult,
} from "./schema";

/**
 * Props for the OptionList component
 */
export interface OptionListProps {
  /** Unique identifier for this option list */
  id: string;
  /** Title displayed above the options */
  title?: string;
  /** Description displayed below the title */
  description?: string;
  /** Array of options to display */
  options: Option[];
  /** Selection mode: 'single' for radio, 'multi' for checkboxes */
  selectionMode?: SelectionMode;
  /** Currently selected value(s) - controlled mode */
  value?: SelectionValue;
  /** Default selected value(s) - uncontrolled mode */
  defaultValue?: SelectionValue;
  /** Selection that has been confirmed (renders receipt state) */
  confirmed?: SelectionValue;
  /** Minimum number of selections required */
  minSelections?: number;
  /** Maximum number of selections allowed */
  maxSelections?: number;
  /** Response action buttons configuration */
  responseActions?: ResponseActions;
  /** Callback when selection changes */
  onChange?: (value: SelectionValue) => void;
  /** Callback when confirm action is triggered */
  onConfirm?: (selection: OptionListSelection) => void | Promise<void>;
  /** Callback when cancel action is triggered */
  onCancel?: () => void;
  /** Callback for any response action */
  onResponseAction?: (actionId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * OptionList component - renders single or multi-select options
 * with optional confirmation flow and receipt state
 */
export function OptionList({
  title,
  description,
  options,
  selectionMode = "single",
  value,
  defaultValue,
  confirmed,
  minSelections,
  maxSelections,
  responseActions,
  onChange,
  onConfirm,
  onCancel,
  onResponseAction,
  className,
}: OptionListProps) {
  // Internal state for uncontrolled mode
  const [internalValue, setInternalValue] = React.useState<string[]>(() =>
    normalizeSelectionValue(defaultValue),
  );

  // Determine if we're in controlled mode
  const isControlled = value !== undefined;
  const selectedIds = isControlled
    ? normalizeSelectionValue(value)
    : internalValue;

  // Check if we're in receipt state (confirmed selection)
  const isReceipt = confirmed !== undefined;
  const confirmedIds = normalizeSelectionValue(confirmed);

  // Handle selection change
  const handleSelectionChange = (newSelection: string[]) => {
    if (isReceipt) return; // Don't allow changes in receipt state

    // Apply max selections constraint
    if (maxSelections !== undefined && newSelection.length > maxSelections) {
      return;
    }

    if (!isControlled) {
      setInternalValue(newSelection);
    }

    // Normalize to single value for single mode
    const outputValue: SelectionValue =
      selectionMode === "single" ? (newSelection[0] ?? null) : newSelection;

    onChange?.(outputValue);
  };

  // Handle single selection (radio)
  const handleSingleSelect = (optionId: string) => {
    handleSelectionChange([optionId]);
  };

  // Handle multi selection (checkbox)
  const handleMultiToggle = (optionId: string, checked: boolean) => {
    const newSelection = checked
      ? [...selectedIds, optionId]
      : selectedIds.filter((id) => id !== optionId);
    handleSelectionChange(newSelection);
  };

  // Validate selection meets constraints
  const isSelectionValid = React.useMemo(() => {
    if (minSelections !== undefined && selectedIds.length < minSelections) {
      return false;
    }
    if (maxSelections !== undefined && selectedIds.length > maxSelections) {
      return false;
    }
    return selectedIds.length > 0;
  }, [selectedIds, minSelections, maxSelections]);

  // Handle response action
  const handleResponseAction = (actionId: string) => {
    if (actionId === "confirm" && onConfirm) {
      const selection = createSelectionResult(selectedIds, options);
      onConfirm(selection);
    } else if (actionId === "cancel" && onCancel) {
      onCancel();
    } else {
      onResponseAction?.(actionId);
    }
  };

  // Receipt state - show only confirmed options
  if (isReceipt) {
    const confirmedOptions = options.filter((opt) =>
      confirmedIds.includes(opt.id),
    );

    return (
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border bg-card p-4 shadow-sm",
          className,
        )}
        data-tool-ui="option-list"
        data-state="receipt"
      >
        {title && (
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            {title}
          </h3>
        )}
        <div className="space-y-2">
          {confirmedOptions.map((option) => (
            <div
              key={option.id}
              className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2"
            >
              <div className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium">{option.label}</span>
                {option.description && (
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default response actions if not provided
  const defaultActions: ResponseActions = [
    { id: "cancel", label: "Reset", variant: "ghost" },
    { id: "confirm", label: "Confirm", variant: "default" },
  ];

  const actions = responseActions ?? defaultActions;

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-2xl border bg-card p-4 shadow-sm",
        className,
      )}
      data-tool-ui="option-list"
      data-state="interactive"
    >
      {/* Header */}
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
          )}
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      {/* Options */}
      {selectionMode === "single" ? (
        <RadioGroupPrimitive.Root
          value={selectedIds[0] ?? ""}
          onValueChange={handleSingleSelect}
          className="space-y-2"
        >
          {options.map((option) => (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
                "hover:bg-accent/50",
                selectedIds.includes(option.id) &&
                  "border-primary bg-primary/5",
                option.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <RadioGroupPrimitive.Item
                value={option.id}
                disabled={option.disabled}
                className={cn(
                  "mt-0.5 flex size-5 items-center justify-center rounded-full border-2",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selectedIds.includes(option.id)
                    ? "border-primary"
                    : "border-muted-foreground/30",
                )}
              >
                <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
                  <Circle className="size-2.5 fill-primary text-primary" />
                </RadioGroupPrimitive.Indicator>
              </RadioGroupPrimitive.Item>
              <div className="flex-1">
                <span className="text-sm font-medium leading-none">
                  {option.label}
                </span>
                {option.description && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {option.description}
                  </p>
                )}
              </div>
            </label>
          ))}
        </RadioGroupPrimitive.Root>
      ) : (
        <div className="space-y-2">
          {options.map((option) => {
            const isChecked = selectedIds.includes(option.id);
            const isDisabled =
              option.disabled ||
              (!isChecked &&
                maxSelections !== undefined &&
                selectedIds.length >= maxSelections);

            return (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
                  "hover:bg-accent/50",
                  isChecked && "border-primary bg-primary/5",
                  isDisabled && "cursor-not-allowed opacity-50",
                )}
              >
                <CheckboxPrimitive.Root
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    handleMultiToggle(option.id, checked === true)
                  }
                  disabled={isDisabled}
                  className={cn(
                    "mt-0.5 flex size-5 items-center justify-center rounded border-2",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isChecked
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/30",
                  )}
                >
                  <CheckboxPrimitive.Indicator className="flex items-center justify-center text-primary-foreground">
                    <Check className="size-3.5" />
                  </CheckboxPrimitive.Indicator>
                </CheckboxPrimitive.Root>
                <div className="flex-1">
                  <span className="text-sm font-medium leading-none">
                    {option.label}
                  </span>
                  {option.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* Selection constraints hint */}
      {(minSelections !== undefined || maxSelections !== undefined) && (
        <p className="mt-3 text-xs text-muted-foreground">
          {minSelections !== undefined && maxSelections !== undefined
            ? `Select ${minSelections} to ${maxSelections} options`
            : minSelections !== undefined
              ? `Select at least ${minSelections} option${minSelections > 1 ? "s" : ""}`
              : `Select up to ${maxSelections} option${maxSelections! > 1 ? "s" : ""}`}
        </p>
      )}

      {/* Action buttons */}
      <div className="mt-4 border-t pt-4">
        <ActionButtons
          actions={actions}
          onAction={handleResponseAction}
          disabled={!isSelectionValid}
        />
      </div>
    </div>
  );
}
