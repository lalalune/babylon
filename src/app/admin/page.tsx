'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { PageContainer } from '@/components/shared/PageContainer'
import { StatsTab } from '@/components/admin/StatsTab'
import { TradingFeedTab } from '@/components/admin/TradingFeedTab'
import { UserManagementTab } from '@/components/admin/UserManagementTab'
import { NotificationsTab } from '@/components/admin/NotificationsTab'
import { GroupsTab } from '@/components/admin/GroupsTab'
import { FeesTab } from '@/components/admin/FeesTab'
import { AdminManagementTab } from '@/components/admin/AdminManagementTab'
import { ReportsTab } from '@/components/admin/ReportsTab'
import { HumanReviewTab } from '@/components/admin/HumanReviewTab'
import { Shield, Activity, Users, BarChart, Bell, MessageSquare, DollarSign, Layers, ShieldCheck, Flag, Sparkles, Database, Bot, Gamepad2, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/shared/Skeleton'
import { RegistryTab } from '@/components/admin/RegistryTab'
import { AIModelsTab } from '@/components/admin/AIModelsTab'
import { TrainingDataTab } from '@/components/admin/TrainingDataTab'
import { AgentsTab } from '@/components/admin/AgentsTab'
import { GameControlTab } from '@/components/admin/GameControlTab'
import { EscrowManagementTab } from '@/components/admin/EscrowManagementTab'

type Tab = 'stats' | 'game-control' | 'fees' | 'trades' | 'users' | 'registry' | 'groups' | 'notifications' | 'admins' | 'reports' | 'human-review' | 'ai-models' | 'training-data' | 'agents' | 'escrow'

export default function AdminDashboard() {
  const router = useRouter()
  const { authenticated, user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('stats')
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  const checkAdminAccess = useCallback(async () => {
    if (!authenticated) {
      // Don't redirect on localhost - let them see the login prompt
      const isLocalhost = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      
      if (!isLocalhost) {
        router.push('/')
        return
      }
      
      setIsAuthorized(false)
      setLoading(false)
      return
    }

    // Check if user is admin by trying to fetch admin stats
    const response = await fetch('/api/admin/stats').catch((error: Error) => {
      console.error('Admin access check failed:', error)
      setIsAuthorized(false)
      setLoading(false)
      throw error
    })
    
    if (!response.ok) {
      setIsAuthorized(false)
      setLoading(false)
      return
    }
    
    setIsAuthorized(true)
    setLoading(false)
  }, [authenticated, router, user])

  useEffect(() => {
    checkAdminAccess()
  }, [checkAdminAccess])

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-full">
          <div className="space-y-4 w-full max-w-md">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
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
    { id: 'game-control' as const, label: 'Game Control', icon: Gamepad2 },
    { id: 'fees' as const, label: 'Fees', icon: DollarSign },
    { id: 'trades' as const, label: 'Trading Feed', icon: Activity },
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'reports' as const, label: 'Reports', icon: Flag },
    { id: 'human-review' as const, label: 'Human Review', icon: Scale },
    { id: 'admins' as const, label: 'Admins', icon: ShieldCheck },
    { id: 'registry' as const, label: 'Registry', icon: Layers },
    { id: 'groups' as const, label: 'Groups', icon: MessageSquare },
    { id: 'agents' as const, label: 'Agents', icon: Bot },
    { id: 'ai-models' as const, label: 'AI Models', icon: Sparkles },
    { id: 'training-data' as const, label: 'Training Data', icon: Database },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'escrow' as const, label: 'Escrow', icon: DollarSign },
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
        {activeTab === 'game-control' && <GameControlTab />}
        {activeTab === 'fees' && <FeesTab />}
        {activeTab === 'trades' && <TradingFeedTab />}
        {activeTab === 'users' && <UserManagementTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'human-review' && <HumanReviewTab />}
        {activeTab === 'admins' && <AdminManagementTab />}
        {activeTab === 'registry' && <RegistryTab />}
        {activeTab === 'groups' && <GroupsTab />}
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'ai-models' && <AIModelsTab />}
        {activeTab === 'training-data' && <TrainingDataTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'escrow' && <EscrowManagementTab />}
      </div>
    </PageContainer>
  )
}

