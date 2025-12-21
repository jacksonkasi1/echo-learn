// ** import types
import type { ToolDefinition, ToolExecutionContext } from "../../types/tools";
import { ToolCategory } from "../../types/tools";

// ** import lib
import { z } from "zod";
import { evaluate, format } from "mathjs";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Calculator tool input schema
 */
const calculatorInputSchema = z.object({
  expression: z
    .string()
    .describe(
      "Mathematical expression to evaluate (e.g., '2 + 2', '10 * 5', 'sqrt(16)')",
    ),
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
 * Safe math expression evaluator using math.js
 * Supports a wide range of mathematical operations safely
 */
function evaluateExpression(expr: string): number {
  try {
    // math.js safely evaluates expressions without code execution risks
    // It supports: arithmetic, trigonometry, logarithms, constants (pi, e), etc.
    const result = evaluate(expr);

    // Ensure result is a number
    if (typeof result !== "number" || !isFinite(result)) {
      // Handle BigNumber or other math.js types
      const numResult = Number(result);
      if (!isFinite(numResult)) {
        throw new Error("Invalid calculation result");
      }
      return numResult;
    }

    return result;
  } catch (error) {
    throw new Error(
      `Failed to evaluate expression: ${error instanceof Error ? error.message : "Invalid expression"}`,
    );
  }
}

/**
 * Calculator Tool
 * Evaluates mathematical expressions using math.js for safe evaluation
 *
 * Supported operations:
 * - Basic arithmetic: +, -, *, /, ^, %
 * - Functions: sqrt, sin, cos, tan, log, exp, abs, round, floor, ceil
 * - Constants: pi, e
 * - Parentheses for grouping
 */
export const calculatorTool: ToolDefinition<CalculatorInput, CalculatorOutput> =
  {
    name: "calculator",
    description:
      "Evaluate mathematical expressions and return the result. " +
      "Supports: basic arithmetic (+, -, *, /, ^), functions (sqrt, sin, cos, tan, log, exp, abs, round), " +
      "constants (pi, e), and parentheses for grouping. " +
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

        // Evaluate the expression using math.js
        const result = evaluateExpression(input.expression);

        // Format the result with specified precision
        const formattedResult = format(result, {
          precision: input.precision + 1,
        });

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
