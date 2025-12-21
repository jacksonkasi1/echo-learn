import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { Dashboard } from '@/components/learning/Dashboard'
import { useUserId } from '@/lib/user-context'
import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const userId = useUserId()
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon" title="Back to chat">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Learning Dashboard</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          title="Refresh analytics"
        >
          <RefreshCw className="size-5" />
        </Button>
      </div>
      <Dashboard key={refreshKey} userId={userId} />
    </div>
  )
}
