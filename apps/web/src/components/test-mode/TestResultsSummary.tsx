import { BookOpen, Target, TrendingUp, Trophy } from "lucide-react";
import { SESSION_SCORE_THRESHOLDS } from "@repo/shared";
import type { TestSessionSummary } from "@repo/shared";
import { Button } from "@/components/ui/button";

interface TestResultsSummaryProps {
  summary: TestSessionSummary;
  onRetake: () => void;
  onReview: (conceptId: string) => void;
  onClose: () => void;
}

function getScoreLevel(score: number): {
  label: string;
  color: string;
} {
  if (score >= SESSION_SCORE_THRESHOLDS.excellent) {
    return { label: "Excellent", color: "text-green-500" };
  }
  if (score >= SESSION_SCORE_THRESHOLDS.good) {
    return { label: "Good", color: "text-blue-500" };
  }
  if (score >= SESSION_SCORE_THRESHOLDS.needsWork) {
    return { label: "Needs Work", color: "text-yellow-500" };
  }
  return { label: "Keep Practicing", color: "text-orange-500" };
}

export function TestResultsSummary({
  summary,
  onRetake,
  onReview,
  onClose,
}: TestResultsSummaryProps) {
  const scorePercentage = Math.round(summary.score);
  const scoreLevel = getScoreLevel(scorePercentage);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      {/* Score Header */}
      <div className="text-center space-y-3">
        <Trophy className="size-12 mx-auto text-yellow-500" />
        <h2 className="text-2xl font-bold">Test Complete!</h2>
        <div className="text-5xl font-bold text-primary">{scorePercentage}%</div>
        <p className={scoreLevel.color}>{scoreLevel.label}</p>
        <p className="text-sm text-muted-foreground">
          {summary.questionsAnswered} questions · {summary.duration} min
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
          <div className="text-xl font-bold text-green-600">
            {summary.correct.length}
          </div>
          <div className="text-xs text-muted-foreground">Correct</div>
        </div>
        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg text-center">
          <div className="text-xl font-bold text-yellow-600">
            {summary.partial.length}
          </div>
          <div className="text-xs text-muted-foreground">Partial</div>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-center">
          <div className="text-xl font-bold text-red-600">
            {summary.incorrect.length}
          </div>
          <div className="text-xs text-muted-foreground">Incorrect</div>
        </div>
      </div>

      {/* Concepts Breakdown */}
      <div className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Target className="size-4" />
          Concept Performance
        </h3>

        {/* Strong Areas */}
        {summary.correct.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-green-600 uppercase tracking-wide">
              Strong Areas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {summary.correct.map((item) => (
                <span
                  key={item.conceptId}
                  className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md text-xs"
                >
                  {item.conceptLabel}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Needs Review */}
        {(summary.incorrect.length > 0 || summary.partial.length > 0) && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-orange-600 uppercase tracking-wide">
              Needs Review
            </p>
            <div className="space-y-2">
              {[...summary.incorrect, ...summary.partial].map((item) => (
                <div
                  key={item.conceptId}
                  className="flex items-center justify-between p-2.5 bg-orange-50 dark:bg-orange-950/30 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {item.conceptLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Mastery: {Math.round(item.masteryBefore * 100)}% →{" "}
                      {Math.round(item.masteryAfter * 100)}%
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReview(item.conceptId)}
                    className="shrink-0 ml-2"
                  >
                    <BookOpen className="size-3.5 mr-1" />
                    Review
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recommendations */}
      {summary.recommendations.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <TrendingUp className="size-4" />
            Recommendations
          </h3>
          <ul className="space-y-1.5">
            {summary.recommendations.slice(0, 3).map((rec, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="text-primary shrink-0">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Done
        </Button>
        <Button onClick={onRetake} className="flex-1">
          Take Another Test
        </Button>
      </div>
    </div>
  );
}
