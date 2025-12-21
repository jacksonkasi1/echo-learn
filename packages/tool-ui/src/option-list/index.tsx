// OptionList component exports
import * as React from "react";

export * from "./option-list";
export * from "./schema";

// Re-export commonly used types
export type {
  Option,
  SelectionMode,
  SelectionValue,
  OptionListSelection,
  SerializableOptionList,
} from "./schema";

/**
 * Error boundary props
 */
interface OptionListErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Error boundary state
 */
interface OptionListErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for OptionList
 * Catches rendering errors and displays a fallback UI
 */
export class OptionListErrorBoundary extends React.Component<
  OptionListErrorBoundaryProps,
  OptionListErrorBoundaryState
> {
  constructor(props: OptionListErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): OptionListErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("OptionList error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full max-w-md rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">Failed to render options</p>
          <p className="mt-1 text-xs opacity-80">
            {this.state.error?.message ?? "An unexpected error occurred"}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
