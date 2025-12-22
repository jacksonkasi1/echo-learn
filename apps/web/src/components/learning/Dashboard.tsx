import { useEffect, useState } from 'react'
import {
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
  Target,
  TrendingUp,
} from 'lucide-react'
import type { LearningAnalytics } from '@/api'
import { cn } from '@/lib/utils'
import { learningApi } from '@/api'

export function Dashboard({ userId }: { userId: string }) {
  const [data, setData] = useState<LearningAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const analyticsData = await learningApi.getAnalytics(userId)
        setData(analyticsData)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch analytics:', err)
        setError('Failed to load learning analytics')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6 p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Concepts"
          value={data.summary.totalConcepts}
          icon={<Brain className="size-4 text-muted-foreground" />}
          description={`${data.summary.masteredConcepts} mastered`}
        />
        <StatCard
          title="Average Mastery"
          value={`${Math.round(data.summary.averageMastery * 100)}%`}
          icon={<TrendingUp className="size-4 text-muted-foreground" />}
          description="Overall progress"
        />
        <StatCard
          title="Due for Review"
          value={data.summary.conceptsDueForReview}
          icon={<Clock className="size-4 text-muted-foreground" />}
          description="Requires attention"
        />
        <StatCard
          title="Weak Areas"
          value={data.summary.weakConcepts}
          icon={<Target className="size-4 text-muted-foreground" />}
          description="Needs improvement"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Focus Areas (Weakest Concepts)">
          <div className="space-y-4">
            {data.weaknesses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No weak areas found! Great job.
              </p>
            ) : (
              data.weaknesses.map((item) => (
                <div
                  key={item.conceptId}
                  className="flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {item.conceptLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.totalAttempts} attempts
                    </p>
                  </div>
                  <MasteryBar value={item.mastery} />
                </div>
              ))
            )}
          </div>
        </Card>

        <Card title="Top Strengths">
          <div className="space-y-4">
            {data.strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keep learning to build strengths!
              </p>
            ) : (
              data.strengths.map((item) => (
                <div
                  key={item.conceptId}
                  className="flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {item.conceptLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.streak} correct streak
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-green-500" />
                    <span className="text-sm font-medium">
                      {Math.round(item.mastery * 100)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string
  value: string | number
  icon: React.ReactNode
  description: string
}) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="tracking-tight text-sm font-medium">{title}</h3>
        {icon}
      </div>
      <div className="p-6 pt-0">
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="font-semibold leading-none tracking-tight">{title}</h3>
      </div>
      <div className="p-6 pt-0">{children}</div>
    </div>
  )
}

function MasteryBar({ value }: { value: number }) {
  let colorClass = 'bg-red-500'
  if (value >= 0.8) colorClass = 'bg-green-500'
  else if (value >= 0.5) colorClass = 'bg-yellow-500'
  else if (value >= 0.3) colorClass = 'bg-orange-500'

  return (
    <div className="flex items-center gap-2 w-24">
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn('h-full', colorClass)}
          style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
        />
      </div>
      <span className="text-xs font-medium w-8 text-right">
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}
