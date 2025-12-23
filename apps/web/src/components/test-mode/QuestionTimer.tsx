import { useEffect, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionTimerProps {
  duration: number;
  onTimeout: () => void;
  isPaused?: boolean;
  className?: string;
}

export function QuestionTimer({
  duration,
  onTimeout,
  isPaused = false,
  className,
}: QuestionTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(duration);

  useEffect(() => {
    if (isPaused || timeRemaining <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((t) => {
        if (t <= 1) {
          onTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, timeRemaining, onTimeout]);

  // Reset when duration changes (new question)
  useEffect(() => {
    setTimeRemaining(duration);
  }, [duration]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const percentage = (timeRemaining / duration) * 100;

  const isLow = timeRemaining <= 10;
  const isWarning = timeRemaining <= 30 && timeRemaining > 10;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isLow ? (
        <AlertTriangle className="size-4 text-red-500 animate-pulse" />
      ) : (
        <Clock
          className={cn(
            "size-4",
            isWarning ? "text-yellow-500" : "text-muted-foreground"
          )}
        />
      )}

      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-1000 ease-linear",
            isLow ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-primary"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <span
        className={cn(
          "font-mono text-xs font-medium min-w-[2.5rem] text-right",
          isLow ? "text-red-500" : isWarning ? "text-yellow-500" : ""
        )}
      >
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
    </div>
  );
}
