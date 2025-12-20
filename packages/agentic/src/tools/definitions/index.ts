// ** import tools
import { searchRAGTool } from "./search-rag.tool";
import { rerankTool } from "./rerank.tool";
import { calculatorTool } from "./calculator.tool";

// ** export individual tools
export { searchRAGTool } from "./search-rag.tool";
export { rerankTool } from "./rerank.tool";
export { calculatorTool } from "./calculator.tool";

/**
 * All available tool definitions
 * Add new tools here to make them available to the agentic system
 *
 * Example of adding more tools:
 * import { calculatorTool } from "./calculator.tool";
 * import { weatherTool } from "./weather.tool";
 *
 * Then add them to the allTools array below
 */
export const allTools = [
  searchRAGTool,
  rerankTool,
  calculatorTool,
  // Add more tools here...
  // weatherTool,
  // ... 100+ tools can be added easily
] as const;

/**
 * Default tools to register on startup
 */
export const defaultTools = allTools;
