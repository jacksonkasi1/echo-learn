// ** export types
export * from "./tools";
export * from "./query";

export interface TestSessionProgress {
  current: number;
  total: number;
  score: number;
  remaining: number;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
}
