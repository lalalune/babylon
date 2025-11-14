'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { PageContainer } from '@/components/shared/PageContainer'
import { StatsTab } from '@/components/admin/StatsTab'
import { TradingFeedTab } from '@/components/admin/TradingFeedTab'
import { UserManagementTab } from '@/components/admin/UserManagementTab'
import { Shield, Activity, Users, BarChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BouncingLogo } from '@/components/shared/BouncingLogo'

type Tab = 'stats' | 'trades' | 'users'

export default function AdminDashboard() {
  const router = useRouter()
  const { authenticated, user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('stats')
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  const checkAdminAccess = useCallback(async () => {
    if (!authenticated) {
      router.push('/')
      return
    }

    try {
      // Check if user is admin by trying to fetch admin stats
      const response = await fetch('/api/admin/stats')
      if (!response.ok) {
        setIsAuthorized(false)
        setLoading(false)
        return
      }
      setIsAuthorized(true)
      setLoading(false)
    } catch (error) {
      console.error('Admin access check failed:', error)
      setIsAuthorized(false)
      setLoading(false)
    }
  }, [authenticated, router, user])

  useEffect(() => {
    checkAdminAccess()
  }, [checkAdminAccess])

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-full">
          <BouncingLogo size={48} />
        </div>
      </PageContainer>
    )
  }

  if (!isAuthorized) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center h-full">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don&apos;t have permission to access the admin dashboard.</p>
        </div>
      </PageContainer>
    )
  }

  const tabs = [
    { id: 'stats' as const, label: 'Dashboard', icon: BarChart },
    { id: 'trades' as const, label: 'Trading Feed', icon: Activity },
    { id: 'users' as const, label: 'Users', icon: Users },
  ]

  return (
    <PageContainer className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border pb-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
        </div>
        <p className="text-muted-foreground">System management and monitoring</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 font-medium transition-colors whitespace-nowrap',
                'border-b-2 -mb-[1px]',
                activeTab === tab.id
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'trades' && <TradingFeedTab />}
        {activeTab === 'users' && <UserManagementTab />}
      </div>
    </PageContainer>
  )
}

