// @repo/tool-ui - Tool UI components for Echo Learn
// Conversation-native UI components for agentic chat interfaces

// Shared utilities and types
export * from "./shared";

// OptionList component - for single/multi-select decisions
export * from "./option-list";

// Plan component - for progress tracking and todo lists
export * from "./plan";

// Frontend tools for assistant-ui integration
export * from "./tools";

// Re-export commonly used types at top level for convenience
export type {
  // Shared types
  SerializableAction,
  ActionVariant,
  ActionsConfig,
  ResponseActions,
  Receipt,
  ReceiptOutcome,
  ToolUIRole,
  BaseToolUI,
} from "./shared";

export type {
  // OptionList types
  Option,
  SelectionMode,
  SelectionValue,
  OptionListSelection,
  SerializableOptionList,
} from "./option-list";

export type {
  // Plan types
  TodoItem,
  TodoStatus,
  SerializablePlan,
} from "./plan";

export type {
  // Tool types
  QuizQuestionProps,
  QuizQuestionToolArgs,
  TestProgressProps,
  TestProgressItem,
  TestSessionData,
  TestProgressToolArgs,
} from "./tools";
