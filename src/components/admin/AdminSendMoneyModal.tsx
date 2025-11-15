'use client'

import { useState, useCallback, useEffect } from 'react'
import { useFundWallet, usePrivy } from '@privy-io/react-auth'
import { X, DollarSign, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Address } from 'viem'
import { formatEther } from 'viem'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import { useSmartWalletBalance } from '@/hooks/useSmartWalletBalance'
import { CHAIN } from '@/constants/chains'
import { WALLET_ERROR_MESSAGES } from '@/lib/wallet-utils'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

interface AdminSendMoneyModalProps {
  isOpen: boolean
  onClose: () => void
  recipientId: string
  recipientName: string
  recipientUsername?: string | null
  recipientWalletAddress?: string | null
  onSuccess?: () => void
}

type PaymentStep = 'input' | 'payment' | 'verifying' | 'success' | 'error'

interface PaymentRequest {
  requestId: string
  to: string
  from: string
  amount: string
}

export function AdminSendMoneyModal({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  recipientUsername,
  recipientWalletAddress,
  onSuccess,
}: AdminSendMoneyModalProps) {
  const { getAccessToken } = usePrivy()
  const { fundWallet } = useFundWallet()
  const { sendSmartWalletTransaction, smartWalletAddress, smartWalletReady } = useSmartWallet()
  const { balance, refreshBalance } = useSmartWalletBalance()

  const [amountUSD, setAmountUSD] = useState('10')
  const [reason, setReason] = useState('')
  const [step, setStep] = useState<PaymentStep>('input')
  const [loading, setLoading] = useState(false)
  const [escrowId, setEscrowId] = useState<string | null>(null)
  // paymentRequest is passed directly to handleSendPayment, no state needed
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ensureFunds = useCallback(
    async (requiredAmountWei: bigint) => {
      if (!smartWalletAddress) {
        throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET)
      }

      const currentBalance = balance ?? (await refreshBalance())
      if (currentBalance !== null && currentBalance >= requiredAmountWei) {
        return true
      }

      const deficit =
        requiredAmountWei - (currentBalance ?? 0n) > 0n
          ? requiredAmountWei - (currentBalance ?? 0n)
          : requiredAmountWei

      try {
        await fundWallet({
          address: smartWalletAddress as Address,
          options: {
            chain: CHAIN,
            amount: formatEther(deficit),
            asset: 'native-currency',
          },
        })
      } catch (fundingError) {
        throw new Error(
          fundingError instanceof Error
            ? fundingError.message
            : 'Funding flow cancelled. Please add funds to continue.'
        )
      }

      // Poll for balance updates
      const maxAttempts = 30
      const pollInterval = 1000
      
      toast.info('Waiting for deposit to settle...')
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const updatedBalance = await refreshBalance()
        
        if (updatedBalance && updatedBalance >= requiredAmountWei) {
          toast.success('Funds received!')
          return true
        }
        
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollInterval))
        }
      }

      toast.error('Deposit is taking longer than expected')
      throw new Error('Funds are still settling. Please try again in a moment.')
    },
    [balance, fundWallet, refreshBalance, smartWalletAddress]
  )

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setAmountUSD('10')
        setReason('')
        setStep('input')
        setLoading(false)
        setEscrowId(null)
        setTxHash(null)
        setError(null)
      }, 300)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = ''
      return
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading && step === 'input') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose, loading, step])

  if (!isOpen) return null

  const amountNum = parseFloat(amountUSD) || 0

  if (!recipientWalletAddress) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-background rounded-2xl shadow-xl w-full max-w-md border border-border">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-xl font-bold">Send Money</h2>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-muted/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-500">Wallet Address Required</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {recipientName} needs to connect a wallet address before you can send money.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full mt-4 px-4 py-3 rounded-lg font-semibold border border-border hover:bg-muted/50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleCreatePayment = async () => {
    if (!smartWalletAddress || !smartWalletReady) {
      toast.error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET)
      return
    }

    if (amountNum < 0.01) {
      toast.error('Minimum amount is $0.01')
      return
    }

    if (amountNum > 10000) {
      toast.error('Maximum amount is $10,000')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('Authentication required')
      }

      // Create escrow payment request
      const response = await fetch('/api/admin/moderation-escrow/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientId,
          amountUSD: amountNum,
          reason: reason.trim() || undefined,
          recipientWalletAddress,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create payment request')
      }

      setEscrowId(data.escrow.id)
      const paymentReq = data.paymentRequest as PaymentRequest
      setStep('payment')

      // Initiate blockchain transaction
      // Note: Admin sends payment from their wallet to treasury
      await handleSendPayment(paymentReq)
    } catch (err) {
      logger.error('Failed to create escrow payment', { error: err }, 'AdminSendMoneyModal')
      setError(err instanceof Error ? err.message : 'Failed to create payment request')
      setStep('error')
      toast.error('Failed to create payment request')
    } finally {
      setLoading(false)
    }
  }

  const handleSendPayment = async (paymentReq: PaymentRequest) => {
    setLoading(true)
    setStep('payment')

    try {
      if (!smartWalletReady || !smartWalletAddress) {
        throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET)
      }

      const requiredAmountWei = BigInt(paymentReq.amount)
      await ensureFunds(requiredAmountWei)

      const hash = await sendSmartWalletTransaction({
        to: paymentReq.to as Address,
        value: requiredAmountWei,
        chain: CHAIN,
      })

      setTxHash(hash)
      setStep('verifying')

      // Verify payment
      await handleVerifyPayment(hash, paymentReq)
    } catch (err) {
      logger.error('Escrow payment failed', { error: err }, 'AdminSendMoneyModal')
      const errorMessage = err instanceof Error ? err.message : 'Payment failed'
      setError(errorMessage)
      setStep('error')
      toast.error('Payment transaction failed')
      setLoading(false)
    }
  }

  const handleVerifyPayment = async (transactionHash: string, paymentReq: PaymentRequest) => {
    try {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('Authentication required')
      }

      // Wait for transaction confirmation
      await new Promise((resolve) => setTimeout(resolve, 3000))

      const response = await fetch('/api/admin/moderation-escrow/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          escrowId,
          txHash: transactionHash,
          fromAddress: smartWalletAddress || paymentReq.from,
          toAddress: paymentReq.to,
          amount: paymentReq.amount,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to verify payment')
      }

      setStep('success')
      toast.success(`Successfully sent $${amountNum} to ${recipientName}!`)

      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      logger.error('Payment verification failed', { error: err }, 'AdminSendMoneyModal')
      setError(err instanceof Error ? err.message : 'Payment verification failed')
      setStep('error')
      toast.error('Failed to verify payment')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading || step === 'payment' || step === 'verifying') {
      return
    }
    onClose()
  }

  const renderContent = () => {
    switch (step) {
      case 'input':
        return (
          <>
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 mb-4">
                <p className="text-sm text-muted-foreground">
                  Sending money to <strong>{recipientName}</strong>
                  {recipientUsername && ` (@${recipientUsername})`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Wallet: {recipientWalletAddress?.slice(0, 6)}...{recipientWalletAddress?.slice(-4)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Amount (USD)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    type="number"
                    min="0.01"
                    max="10000"
                    step="0.01"
                    value={amountUSD}
                    onChange={(e) => setAmountUSD(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="10.00"
                    disabled={loading}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Min: $0.01 • Max: $10,000
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why are you sending this payment? (compensation, refund, etc.)"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3}
                  maxLength={500}
                  disabled={loading}
                />
                <div className="text-xs text-muted-foreground mt-1 text-right">
                  {reason.length}/500
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-lg font-semibold border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePayment}
                disabled={loading || !amountUSD || amountNum < 0.01}
                className={cn(
                  "flex-1 px-4 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  "flex items-center justify-center gap-2"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4" />
                    Create Payment
                  </>
                )}
              </button>
            </div>
          </>
        )

      case 'payment':
        return (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-semibold mb-2">Sending Payment</p>
            <p className="text-sm text-muted-foreground">
              Please confirm the transaction in your wallet
            </p>
          </div>
        )

      case 'verifying':
        return (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-semibold mb-2">Verifying Payment</p>
            <p className="text-sm text-muted-foreground">
              Confirming your payment on the blockchain...
            </p>
            {txHash && (
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </p>
            )}
          </div>
        )

      case 'success':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-lg font-semibold mb-2">Payment Sent!</p>
            <p className="text-sm text-muted-foreground">
              ${amountNum} sent to {recipientName}
            </p>
            {txHash && (
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </p>
            )}
            <button
              onClick={handleClose}
              className="w-full mt-6 px-4 py-3 rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Close
            </button>
          </div>
        )

      case 'error':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-lg font-semibold mb-2 text-red-600">Payment Failed</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('input')
                  setError(null)
                }}
                className="flex-1 px-4 py-3 rounded-lg font-semibold border border-border hover:bg-muted/50 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-3 rounded-lg font-semibold bg-muted hover:bg-muted/80 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-background rounded-2xl shadow-xl w-full max-w-md border border-border">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold">Send Money (Escrow)</h2>
          <button
            onClick={handleClose}
            disabled={loading || step === 'payment' || step === 'verifying'}
            className="rounded-full p-2 hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{renderContent()}</div>
      </div>
    </div>
  )
}

