// Plan component exports
import * as React from "react";

export * from "./plan";
export * from "./schema";

// Re-export commonly used types
export type {
  TodoItem,
  TodoStatus,
  SerializablePlan,
} from "./schema";

/**
 * Error boundary props
 */
interface PlanErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Error boundary state
 */
interface PlanErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for Plan
 * Catches rendering errors and displays a fallback UI
 */
export class PlanErrorBoundary extends React.Component<
  PlanErrorBoundaryProps,
  PlanErrorBoundaryState
> {
  constructor(props: PlanErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PlanErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Plan error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full max-w-md rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">Failed to render plan</p>
          <p className="mt-1 text-xs opacity-80">
            {this.state.error?.message ?? "An unexpected error occurred"}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
