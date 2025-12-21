// ** import tools
import { searchRAGTool } from "./search-rag.tool";
import { rerankTool } from "./rerank.tool";
import { calculatorTool } from "./calculator.tool";
import { saveLearningTool } from "./save-learning.tool";
import { queryGraphTool } from "./query-graph.tool";

// ** export individual tools
export { searchRAGTool } from "./search-rag.tool";
export { rerankTool } from "./rerank.tool";
export { calculatorTool } from "./calculator.tool";
export { saveLearningTool } from "./save-learning.tool";
export { queryGraphTool } from "./query-graph.tool";

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
  saveLearningTool,
  queryGraphTool,
  // Add more tools here...
  // weatherTool,
  // ... 100+ tools can be added easily
] as const;

/**
 * Default tools to register on startup
 */
export const defaultTools = allTools;
