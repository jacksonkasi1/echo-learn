// ** import types
import type { ToolDefinition, ToolExecutionContext } from "../../types/tools";
import { ToolCategory } from "../../types/tools";

// ** import lib
import { z } from "zod";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Calculator tool input schema
 */
const calculatorInputSchema = z.object({
  expression: z
    .string()
    .describe("Mathematical expression to evaluate (e.g., '2 + 2', '10 * 5')"),
  precision: z
    .number()
    .int()
    .min(0)
    .max(10)
    .default(2)
    .describe("Number of decimal places for the result"),
});

type CalculatorInput = z.infer<typeof calculatorInputSchema>;

/**
 * Calculator tool output
 */
export interface CalculatorOutput {
  result: number;
  expression: string;
  formattedResult: string;
}

/**
 * Safe math expression evaluator
 * Only allows basic arithmetic operations
 */
function evaluateExpression(expr: string): number {
  // Remove whitespace
  const cleaned = expr.replace(/\s+/g, "");

  // Only allow numbers and basic operators
  if (!/^[0-9+\-*/.()]+$/.test(cleaned)) {
    throw new Error("Expression contains invalid characters");
  }

  // Use Function constructor for safer evaluation (still not production-ready)
  // In production, use a proper math parser library like math.js
  try {
    const result = Function(`"use strict"; return (${cleaned})`)();
    if (typeof result !== "number" || !isFinite(result)) {
      throw new Error("Invalid calculation result");
    }
    return result;
  } catch (error) {
    throw new Error("Failed to evaluate expression");
  }
}

/**
 * Calculator Tool (Example)
 * Evaluates mathematical expressions
 *
 * This is an example tool to demonstrate how easy it is to add new tools.
 * To enable this tool, rename this file to remove '.example' and add it to
 * the allTools array in definitions/index.ts
 */
export const calculatorTool: ToolDefinition<CalculatorInput, CalculatorOutput> =
  {
    name: "calculator",
    description:
      "Evaluate mathematical expressions and return the result. " +
      "Supports basic arithmetic operations: addition (+), subtraction (-), " +
      "multiplication (*), division (/), and parentheses for grouping. " +
      "Use this tool when the user asks for calculations or math problems.",

    inputSchema: calculatorInputSchema,

    category: ToolCategory.CALCULATION,
    requiresApproval: false,
    timeout: 5000, // 5 seconds
    cost: 0.5, // Low cost
    cacheable: true,
    cacheTTL: 3600, // 1 hour

    async execute(input: CalculatorInput, context: ToolExecutionContext) {
      const startTime = Date.now();

      try {
        logger.info("Executing calculator", {
          userId: context.userId,
          expression: input.expression,
          precision: input.precision,
        });

        // Evaluate the expression
        const result = evaluateExpression(input.expression);

        // Format the result
        const formattedResult = result.toFixed(input.precision);

        const executionTime = Date.now() - startTime;

        logger.info("Calculator completed", {
          userId: context.userId,
          result,
          executionTime,
        });

        return {
          result,
          expression: input.expression,
          formattedResult,
        };
      } catch (error) {
        logger.error("Calculator failed", {
          error: error instanceof Error ? error.message : "Unknown error",
          userId: context.userId,
          expression: input.expression,
        });

        throw new Error(
          `Calculator error: ${error instanceof Error ? error.message : "Invalid expression"}`,
        );
      }
    },
  };

/**
 * To enable this tool:
 *
 * 1. Rename this file from 'calculator.tool.example.ts' to 'calculator.tool.ts'
 *
 * 2. Add to src/tools/definitions/index.ts:
 *    import { calculatorTool } from "./calculator.tool";
 *    export { calculatorTool } from "./calculator.tool";
 *
 * 3. Add to the allTools array:
 *    export const allTools = [
 *      searchRAGTool,
 *      rerankTool,
 *      calculatorTool,  // <-- Add here
 *    ] as const;
 *
 * That's it! The tool is now available system-wide.
 */
