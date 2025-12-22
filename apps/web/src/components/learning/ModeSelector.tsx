import { useState } from "react";
import { ChevronDown, ClipboardList, GraduationCap, MessageSquare } from "lucide-react";
import {  useLearningContext } from "./LearningContext";
import type {ChatMode} from "./LearningContext";
import { cn } from "@/lib/utils";

const MODES: Record<ChatMode, { label: string; icon: React.ReactNode; description: string }> = {
  learn: {
    label: "Learn",
    icon: <GraduationCap className="size-4" />,
    description: "Automatic progress tracking",
  },
  chat: {
    label: "Chat",
    icon: <MessageSquare className="size-4" />,
    description: "Off-the-record conversation",
  },
  test: {
    label: "Test",
    icon: <ClipboardList className="size-4" />,
    description: "Active knowledge testing",
  },
};

export function ModeSelector() {
  const { mode, setMode } = useLearningContext();
  const [isOpen, setIsOpen] = useState(false);

  const currentMode = MODES[mode];

  return (
    <div className="relative inline-block text-left">
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          id="mode-menu-button"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <div className="flex items-center gap-2">
            {currentMode.icon}
            <span>{currentMode.label} Mode</span>
          </div>
          <ChevronDown className="size-4 opacity-50" />
        </button>
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="mode-menu-button"
          >
            <div className="p-1">
              {(Object.keys(MODES) as Array<ChatMode>).map((modeKey) => {
                const modeInfo = MODES[modeKey];
                const isSelected = mode === modeKey;

                return (
                  <button
                    key={modeKey}
                    onClick={() => {
                      setMode(modeKey);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                      isSelected && "bg-accent/50 text-accent-foreground"
                    )}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("flex items-center justify-center size-8 rounded-md border bg-background", isSelected && "border-primary/50 text-primary")}>
                        {modeInfo.icon}
                      </div>
                      <div className="flex flex-col items-start text-left">
                        <span className="font-medium">{modeInfo.label}</span>
                        <span className="text-xs text-muted-foreground">{modeInfo.description}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
