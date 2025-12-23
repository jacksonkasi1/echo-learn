import { useState } from 'react'
import {
  DEFAULT_TEST_CONFIGURATION,
  QUESTION_COUNT_OPTIONS,
  QUESTION_FORMAT_INFO,
  QUESTION_STYLE_INFO,
  SKILL_LEVEL_INFO,
  TIME_PER_QUESTION_OPTIONS,
  TIMING_MODE_INFO,
} from '@repo/shared'
import type {
  QuestionFormat,
  QuestionStyle,
  SkillLevel,
  TestConfiguration,
  TimingMode,
} from '@repo/shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface TestConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onStartTest: (config: TestConfiguration) => void
}

export function TestConfigModal({
  isOpen,
  onClose,
  onStartTest,
}: TestConfigModalProps) {
  const [config, setConfig] = useState<TestConfiguration>(
    DEFAULT_TEST_CONFIGURATION,
  )

  const handleStartTest = () => {
    onStartTest(config)
  }

  const updateConfig = <TKey extends keyof TestConfiguration>(
    key: TKey,
    value: TestConfiguration[TKey],
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Configure Your Test</AlertDialogTitle>
          <AlertDialogDescription>
            Customize your test experience before starting.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-5 py-4">
          {/* Skill Level */}
          <div className="space-y-2">
            <Label htmlFor="skill-level">Skill Level</Label>
            <Select
              value={config.skillLevel}
              onValueChange={(value: SkillLevel) =>
                updateConfig('skillLevel', value)
              }
            >
              <SelectTrigger id="skill-level" className="w-full">
                <SelectValue placeholder="Select skill level" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SKILL_LEVEL_INFO) as Array<SkillLevel>).map(
                  (level) => (
                    <SelectItem key={level} value={level}>
                      <div className="flex flex-col items-start">
                        <span>{SKILL_LEVEL_INFO[level].label}</span>
                        <span className="text-xs text-muted-foreground">
                          {SKILL_LEVEL_INFO[level].description}
                        </span>
                      </div>
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Question Style */}
          <div className="space-y-2">
            <Label htmlFor="question-style">Question Style</Label>
            <Select
              value={config.questionStyle}
              onValueChange={(value: QuestionStyle) =>
                updateConfig('questionStyle', value)
              }
            >
              <SelectTrigger id="question-style" className="w-full">
                <SelectValue placeholder="Select question style" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(QUESTION_STYLE_INFO) as Array<QuestionStyle>).map(
                  (style) => (
                    <SelectItem key={style} value={style}>
                      <div className="flex flex-col items-start">
                        <span>{QUESTION_STYLE_INFO[style].label}</span>
                        <span className="text-xs text-muted-foreground">
                          {QUESTION_STYLE_INFO[style].description}
                        </span>
                      </div>
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Question Format */}
          <div className="space-y-2">
            <Label htmlFor="question-format">Answer Format</Label>
            <Select
              value={config.questionFormat}
              onValueChange={(value: QuestionFormat) =>
                updateConfig('questionFormat', value)
              }
            >
              <SelectTrigger id="question-format" className="w-full">
                <SelectValue placeholder="Select answer format" />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(QUESTION_FORMAT_INFO) as Array<QuestionFormat>
                ).map((format) => (
                  <SelectItem key={format} value={format}>
                    <div className="flex flex-col items-start">
                      <span>{QUESTION_FORMAT_INFO[format].label}</span>
                      <span className="text-xs text-muted-foreground">
                        {QUESTION_FORMAT_INFO[format].description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Number of Questions */}
          <div className="space-y-2">
            <Label htmlFor="question-count">Number of Questions</Label>
            <Select
              value={String(config.questionCount)}
              onValueChange={(value) =>
                updateConfig('questionCount', Number(value))
              }
            >
              <SelectTrigger id="question-count" className="w-full">
                <SelectValue placeholder="Select number of questions" />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_COUNT_OPTIONS.map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count} questions
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timing Mode */}
          <div className="space-y-2">
            <Label htmlFor="timing-mode">Timing</Label>
            <Select
              value={config.timingMode}
              onValueChange={(value: TimingMode) =>
                updateConfig('timingMode', value)
              }
            >
              <SelectTrigger id="timing-mode" className="w-full">
                <SelectValue placeholder="Select timing mode" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIMING_MODE_INFO) as Array<TimingMode>).map(
                  (mode) => (
                    <SelectItem key={mode} value={mode}>
                      <div className="flex flex-col items-start">
                        <span>{TIMING_MODE_INFO[mode].label}</span>
                        <span className="text-xs text-muted-foreground">
                          {TIMING_MODE_INFO[mode].description}
                        </span>
                      </div>
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Time per Question (conditional) */}
          {config.timingMode === 'timed' && (
            <div className="space-y-2">
              <Label htmlFor="time-per-question">Time per Question</Label>
              <Select
                value={String(config.timePerQuestion || 60)}
                onValueChange={(value) =>
                  updateConfig('timePerQuestion', Number(value))
                }
              >
                <SelectTrigger id="time-per-question" className="w-full">
                  <SelectValue placeholder="Select time limit" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_PER_QUESTION_OPTIONS.map((seconds) => (
                    <SelectItem key={seconds} value={String(seconds)}>
                      {seconds >= 60
                        ? `${seconds / 60} minute${seconds > 60 ? 's' : ''}`
                        : `${seconds} seconds`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleStartTest}>
            Start Test
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
