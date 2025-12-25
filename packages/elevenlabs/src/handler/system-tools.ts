// ** import types
import type {
  SystemToolCall,
  SystemToolResult,
  ElevenLabsTool,
} from "../types/index.js";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Known ElevenLabs system tool names
 */
export const SYSTEM_TOOL_NAMES = [
  "end_call",
  "skip_turn",
  "language_detection",
  "transfer_to_agent",
  "transfer_to_number",
  "voicemail_detection",
] as const;

export type SystemToolName = (typeof SYSTEM_TOOL_NAMES)[number];

/**
 * Check if a tool name is a system tool
 */
export function isSystemTool(toolName: string): toolName is SystemToolName {
  return SYSTEM_TOOL_NAMES.includes(toolName as SystemToolName);
}

/**
 * Check if the request contains system tools
 */
export function hasSystemTools(tools?: ElevenLabsTool[]): boolean {
  if (!tools || tools.length === 0) {
    return false;
  }

  return tools.some((tool) => isSystemTool(tool.function.name));
}

/**
 * Extract system tools from the tools array
 */
export function extractSystemTools(tools?: ElevenLabsTool[]): ElevenLabsTool[] {
  if (!tools) {
    return [];
  }

  return tools.filter((tool) => isSystemTool(tool.function.name));
}

/**
 * Parse tool call arguments safely
 */
function parseToolArguments(argsJson: string): Record<string, unknown> {
  try {
    return JSON.parse(argsJson) as Record<string, unknown>;
  } catch (error) {
    logger.warn("Failed to parse tool arguments", { argsJson, error });
    return {};
  }
}

/**
 * Handle the end_call system tool
 * Called when the conversation should end
 */
function handleEndCall(args: Record<string, unknown>): SystemToolResult {
  const reason = (args.reason as string) || "Conversation ended";
  const message = args.message as string | undefined;

  logger.info("End call tool invoked", { reason, message });

  return {
    name: "end_call",
    shouldEndCall: true,
    message: message || "Thank you for studying with me. Goodbye!",
    reason,
  };
}

/**
 * Handle the skip_turn system tool
 * Called when the agent should wait silently
 */
function handleSkipTurn(args: Record<string, unknown>): SystemToolResult {
  const reason = (args.reason as string) || "User needs time to think";

  logger.info("Skip turn tool invoked", { reason });

  return {
    name: "skip_turn",
    shouldEndCall: false,
    reason,
  };
}

/**
 * Handle the language_detection system tool
 * Called when language switch is detected
 */
function handleLanguageDetection(
  args: Record<string, unknown>,
): SystemToolResult {
  const reason = (args.reason as string) || "Language switch detected";
  const language = args.language as string | undefined;

  logger.info("Language detection tool invoked", { reason, language });

  return {
    name: "language_detection",
    shouldEndCall: false,
    reason,
  };
}

/**
 * Handle the transfer_to_agent system tool
 * Called when transfer to another agent is needed
 */
function handleTransferToAgent(
  args: Record<string, unknown>,
): SystemToolResult {
  const reason = (args.reason as string) || "Transfer requested";
  const agentNumber = args.agent_number as number | undefined;

  logger.info("Transfer to agent tool invoked", { reason, agentNumber });

  return {
    name: "transfer_to_agent",
    shouldEndCall: true,
    message: "I'm transferring you to another assistant who can help better.",
    reason,
  };
}

/**
 * Handle the transfer_to_number system tool
 * Called when transfer to a phone number is needed
 */
function handleTransferToNumber(
  args: Record<string, unknown>,
): SystemToolResult {
  const reason = (args.reason as string) || "Transfer to human requested";
  const clientMessage = args.client_message as string | undefined;

  logger.info("Transfer to number tool invoked", { reason });

  return {
    name: "transfer_to_number",
    shouldEndCall: true,
    message: clientMessage || "I'm connecting you with a human assistant.",
    reason,
  };
}

/**
 * Handle the voicemail_detection system tool
 * Called when voicemail is detected
 */
function handleVoicemailDetection(
  args: Record<string, unknown>,
): SystemToolResult {
  const reason = (args.reason as string) || "Voicemail detected";

  logger.info("Voicemail detection tool invoked", { reason });

  return {
    name: "voicemail_detection",
    shouldEndCall: true,
    reason,
  };
}

/**
 * Process a system tool call and return the result
 */
export function handleSystemTool(
  toolCall: SystemToolCall,
): SystemToolResult | null {
  const { name, arguments: argsJson } = toolCall.function;

  // Check if it's a known system tool
  if (!isSystemTool(name)) {
    logger.debug("Unknown tool call received", { name });
    return null;
  }

  // Parse arguments
  const args = parseToolArguments(argsJson);

  // Route to appropriate handler
  switch (name) {
    case "end_call":
      return handleEndCall(args);

    case "skip_turn":
      return handleSkipTurn(args);

    case "language_detection":
      return handleLanguageDetection(args);

    case "transfer_to_agent":
      return handleTransferToAgent(args);

    case "transfer_to_number":
      return handleTransferToNumber(args);

    case "voicemail_detection":
      return handleVoicemailDetection(args);

    default:
      // TypeScript exhaustive check
      const _exhaustive: never = name;
      return null;
  }
}
