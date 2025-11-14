import { Card } from '@/components/ui/card'

export default function AgentsLoading() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-48 bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-4 w-96 bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-gray-700 rounded animate-pulse" />
      </div>

      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 w-16 bg-gray-700 rounded animate-pulse" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-700" />
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded w-24 mb-2" />
                <div className="h-3 bg-gray-700 rounded w-16" />
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-3 bg-gray-700 rounded" />
              <div className="h-3 bg-gray-700 rounded w-3/4" />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div className="h-12 bg-gray-700 rounded" />
              <div className="h-12 bg-gray-700 rounded" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

