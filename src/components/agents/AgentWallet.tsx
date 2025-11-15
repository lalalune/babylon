'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { ArrowDownToLine, ArrowUpFromLine, History } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

interface Transaction {
  id: string
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  createdAt: string
}

interface AgentWalletProps {
  agent: {
    id: string
    name: string
    pointsBalance: number
    totalDeposited: number
    totalWithdrawn: number
    totalPointsSpent: number
  }
  onUpdate: () => void
}

export function AgentWallet({ agent, onUpdate }: AgentWalletProps) {
  const { user, getAccessToken } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [action, setAction] = useState<'deposit' | 'withdraw'>('deposit')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchTransactions()
  }, [agent.id])

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        setLoading(false)
        return
      }
      
      const res = await fetch(`/api/agents/${agent.id}/wallet`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.ok) {
        const data = await res.json() as { success: boolean; transactions: Transaction[] }
        if (data.success && data.transactions) {
          setTransactions(data.transactions)
        }
      } else {
        logger.error('Failed to fetch transactions', undefined, 'AgentWallet')
      }
    } catch (error) {
      logger.error('Error fetching transactions', { error }, 'AgentWallet')
    } finally {
      setLoading(false)
    }
  }

  const handleTransaction = async () => {
    const amountNum = parseInt(amount)
    
    if (!amountNum || amountNum <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    const totalPoints = user?.reputationPoints || 0
    
    if (action === 'deposit' && amountNum > totalPoints) {
      toast.error(`Insufficient balance. You have ${totalPoints} points`)
      return
    }

    if (action === 'withdraw' && amountNum > agent.pointsBalance) {
      toast.error(`Insufficient agent balance. Agent has ${agent.pointsBalance} points`)
      return
    }

    setProcessing(true)
    const token = await getAccessToken()
    if (!token) {
      setProcessing(false)
      throw new Error('Authentication required')
    }
    
    const res = await fetch(`/api/agents/${agent.id}/wallet`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, amount: amountNum })
    })

    if (!res.ok) {
      const error = await res.json()
      setProcessing(false)
      throw new Error(error.error || 'Transaction failed')
    }

    const data = await res.json()
    toast.success(data.message)
    setAmount('')
    fetchTransactions()
    onUpdate()
    setProcessing(false)
  }

  const userTotalPoints = user?.reputationPoints || 0

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
          <div className="text-sm text-muted-foreground mb-2">Agent Balance</div>
          <div className="text-3xl font-bold mb-4">{agent.pointsBalance} pts</div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Total Deposited:</span>
              <span>{agent.totalDeposited} pts</span>
            </div>
            <div className="flex justify-between">
              <span>Total Withdrawn:</span>
              <span>{agent.totalWithdrawn} pts</span>
            </div>
            <div className="flex justify-between">
              <span>Total Spent:</span>
              <span>{agent.totalPointsSpent} pts</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
          <div className="text-sm text-muted-foreground mb-2">Your Balance</div>
          <div className="text-3xl font-bold mb-4">{userTotalPoints} pts</div>
          <p className="text-sm text-muted-foreground">
            Available for deposit to agents
          </p>
        </div>
      </div>

      {/* Transaction Form */}
      <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
        <h3 className="text-lg font-semibold mb-4">Transfer Points</h3>
        
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setAction('deposit')}
            className={cn(
              'flex-1 px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
              action === 'deposit'
                ? 'bg-[#0066FF] text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            )}
          >
            <ArrowDownToLine className="w-4 h-4" />
            Deposit
          </button>
          <button
            onClick={() => setAction('withdraw')}
            className={cn(
              'flex-1 px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
              action === 'withdraw'
                ? 'bg-[#0066FF] text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            )}
          >
            <ArrowUpFromLine className="w-4 h-4" />
            Withdraw
          </button>
        </div>

        <div className="flex gap-2">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount..."
            min={1}
            max={action === 'deposit' ? userTotalPoints : agent.pointsBalance}
          />
          <button
            onClick={handleTransaction}
            disabled={processing || !amount}
            className="px-6 py-2 rounded-lg bg-[#0066FF] hover:bg-[#2952d9] text-primary-foreground font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Processing...' : action === 'deposit' ? 'Deposit' : 'Withdraw'}
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          {action === 'deposit' 
            ? `Transfer points from your account to ${agent.name}`
            : `Transfer points from ${agent.name} to your account`
          }
        </p>
      </div>

      {/* Transaction History */}
      <div className="p-6 rounded-lg bg-card/50 backdrop-blur border border-border">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Transaction History</h3>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No transactions yet</div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted transition-all"
              >
                <div className="flex-1">
                  <div className="font-medium capitalize">{tx.type.replace('_', ' ')}</div>
                  <div className="text-sm text-muted-foreground">{tx.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    'font-semibold',
                    tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount} pts
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Balance: {tx.balanceAfter} pts
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
