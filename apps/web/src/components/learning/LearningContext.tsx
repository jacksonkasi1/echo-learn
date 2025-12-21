import { createContext, useContext, useState, type ReactNode } from "react";

export type ChatMode = "learn" | "chat" | "test";

interface LearningContextType {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
}

const LearningContext = createContext<LearningContextType | undefined>(
  undefined,
);

export function LearningProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ChatMode>("learn");

  return (
    <LearningContext.Provider value={{ mode, setMode }}>
      {children}
    </LearningContext.Provider>
  );
}

export function useLearningContext() {
  const context = useContext(LearningContext);
  if (context === undefined) {
    throw new Error(
      "useLearningContext must be used within a LearningProvider",
    );
  }
  return context;
}
