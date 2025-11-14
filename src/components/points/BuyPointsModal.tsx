'use client';

import { useCallback, useEffect, useState } from 'react';

import { useFundWallet, usePrivy } from '@privy-io/react-auth';
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Address } from 'viem';
import { formatEther } from 'viem';

import { Skeleton } from '@/components/shared/Skeleton';

import { cn } from '@/lib/utils';
import { WALLET_ERROR_MESSAGES } from '@/lib/wallet-utils';

import { useAuth } from '@/hooks/useAuth';
import { useBuyPointsTx } from '@/hooks/useBuyPointsTx';
import { useSmartWalletBalance } from '@/hooks/useSmartWalletBalance';

import { CHAIN } from '@/constants/chains';

interface BuyPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type PaymentStep = 'input' | 'payment' | 'verifying' | 'success' | 'error';

interface PaymentRequest {
  requestId: string;
  to: string;
  from: string;
  amount: string;
}

export function BuyPointsModal({
  isOpen,
  onClose,
  onSuccess,
}: BuyPointsModalProps) {
  const { user, smartWalletAddress, smartWalletReady } = useAuth();
  const { getAccessToken } = usePrivy();
  const { fundWallet } = useFundWallet();
  const { sendPointsPayment } = useBuyPointsTx();
  const { balance, refreshBalance } = useSmartWalletBalance();

  const [amountUSD, setAmountUSD] = useState('10');
  const [step, setStep] = useState<PaymentStep>('input');
  const [loading, setLoading] = useState(false);
  const [_paymentRequestId, setPaymentRequestId] = useState<string | null>(
    null
  );
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pointsAwarded, setPointsAwarded] = useState(0);

  const ensureFunds = useCallback(
    async (requiredAmountWei: bigint) => {
      if (!smartWalletAddress) {
        throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET);
      }

      const currentBalance = balance ?? (await refreshBalance());
      if (currentBalance !== null && currentBalance >= requiredAmountWei) {
        return true;
      }

      const deficit =
        requiredAmountWei - (currentBalance ?? 0n) > 0n
          ? requiredAmountWei - (currentBalance ?? 0n)
          : requiredAmountWei;

      try {
        await fundWallet({
          address: smartWalletAddress,
          options: {
            chain: CHAIN,
            amount: formatEther(deficit),
            asset: 'native-currency',
          },
        });
      } catch (fundingError) {
        throw new Error(
          fundingError instanceof Error
            ? fundingError.message
            : 'Funding flow cancelled. Please add funds to continue.'
        );
      }

      // Poll for balance updates with timeout (30 seconds)
      const maxAttempts = 30;
      const pollInterval = 1000; // 1 second
      
      // Show feedback to user
      toast.info('Waiting for deposit to settle...');
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const updatedBalance = await refreshBalance();
        
        if (updatedBalance && updatedBalance >= requiredAmountWei) {
          toast.success('Funds received!');
          return true;
        }
        
        // Wait before next check (except on last attempt)
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }

      // If we get here, funds didn't arrive in time
      toast.error('Deposit is taking longer than expected');
      throw new Error(
        'Funds are still settling. Please try again in a moment once the deposit arrives.'
      );
    },
    [balance, fundWallet, refreshBalance, smartWalletAddress]
  );

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setAmountUSD('10');
        setStep('input');
        setLoading(false);
        setPaymentRequestId(null);
        setTxHash(null);
        setError(null);
        setPointsAwarded(0);
      }, 300);
    }
  }, [isOpen]);

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading && step === 'input') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, loading, step]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!isOpen) return null;

  const amountNum = parseFloat(amountUSD) || 0;
  const pointsAmount = Math.floor(amountNum * 100);

  const handleCreatePayment = async () => {
    if (!user || !smartWalletAddress || !smartWalletReady) {
      toast.error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET);
      return;
    }

    if (amountNum < 1) {
      toast.error('Minimum purchase is $1');
      return;
    }

    if (amountNum > 1000) {
      toast.error('Maximum purchase is $1000');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Create payment request
      const response = await fetch('/api/points/purchase/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amountUSD: amountNum,
          fromAddress: smartWalletAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create payment request');
      }

      setPaymentRequestId(data.paymentRequest.requestId);
      setStep('payment');

      // Initiate blockchain transaction
      await handleSendPayment(data.paymentRequest);
    } catch (err) {
      console.error('Failed to create payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to create payment');
      setStep('error');
      toast.error('Failed to create payment request');
    } finally {
      setLoading(false);
    }
  };

  const handleSendPayment = async (paymentRequest: PaymentRequest) => {
    setLoading(true);
    setStep('payment');

    try {
      if (!smartWalletReady || !smartWalletAddress) {
        throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET);
      }

      const requiredAmountWei = BigInt(paymentRequest.amount);
      await ensureFunds(requiredAmountWei);

      const hash = await sendPointsPayment({
        to: paymentRequest.to as Address,
        amountWei: requiredAmountWei,
      });

      setTxHash(hash);
      setStep('verifying');

      // Verify payment and credit points
      await handleVerifyPayment(paymentRequest.requestId, hash, paymentRequest);
    } catch (err) {
      console.error('Payment failed:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Payment failed';

      setError(errorMessage);

      setStep('error');
      toast.error('Payment transaction failed');
      setLoading(false);
    }
  };

  const handleVerifyPayment = async (
    requestId: string,
    transactionHash: string,
    paymentRequest: PaymentRequest
  ) => {
    try {
      const token =
        typeof window !== 'undefined' ? window.__privyAccessToken : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      // Wait a bit for transaction to be confirmed
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const response = await fetch('/api/points/purchase/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId,
          txHash: transactionHash,
          fromAddress: paymentRequest.from,
          toAddress: paymentRequest.to,
          amount: paymentRequest.amount,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to verify payment');
      }

      setPointsAwarded(data.pointsAwarded);
      setStep('success');
      toast.success(`Successfully purchased ${data.pointsAwarded} points!`);

      // Call onSuccess callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Payment verification failed:', err);
      setError(
        err instanceof Error ? err.message : 'Payment verification failed'
      );
      setStep('error');
      toast.error('Failed to verify payment');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading || step === 'payment' || step === 'verifying') {
      return; // Prevent closing during payment
    }
    onClose();
  };

  const renderContent = () => {
    switch (step) {
      case 'input':
        return (
          <>
            <div className="space-y-4">
              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Amount (USD)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    data-testid="points-amount-input"
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    value={amountUSD}
                    onChange={(e) => setAmountUSD(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-sidebar border border-border rounded-lg focus:outline-none focus:border-border"
                    placeholder="10"
                    disabled={loading}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Min: $1 • Max: $1000
                </p>
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[10, 25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setAmountUSD(amt.toString())}
                    className={cn(
                      'px-4 py-2 rounded-lg border transition-colors',
                      amountNum === amt
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-sidebar border-border hover:border-primary'
                    )}
                    disabled={loading}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              {/* Points Calculation */}
              <div className="bg-sidebar border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    You'll receive:
                  </span>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    <span data-testid="points-amount-display" className="text-xl font-bold">
                      {pointsAmount.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      points
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-center mt-2">
                  100 points = $1 USD
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">
                      Points are non-transferable
                    </p>
                    <p>
                      Points can be used for trading and rewards but cannot be
                      transferred to other users.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-3 bg-sidebar border border-border rounded-lg hover:bg-accent transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                data-testid="buy-points-submit-button"
                onClick={handleCreatePayment}
                disabled={loading || amountNum < 1 || amountNum > 1000}
                className={cn(
                  'flex-1 px-4 py-3 rounded-lg font-medium transition-colors',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {loading ? 'Processing...' : `Buy ${pointsAmount} Points`}
              </button>
            </div>
          </>
        );

      case 'payment':
      case 'verifying':
        return (
          <div className="text-center py-8">
            <div className="mx-auto mb-4 flex justify-center">
              <Skeleton className="h-16 w-16 rounded-full" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {step === 'payment'
                ? 'Processing Payment...'
                : 'Verifying Transaction...'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {step === 'payment'
                ? 'Preparing your payment transaction...'
                : 'Confirming your payment on the blockchain'}
            </p>
            {txHash && (
              <a
                data-testid="transaction-hash-link"
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                View transaction
              </a>
            )}
          </div>
        );

      case 'success':
        return (
          <div data-testid="payment-success" className="text-center py-8">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Purchase Successful!</h3>
            <div className="bg-sidebar border border-border rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="h-6 w-6 text-yellow-500" />
                <span data-testid="points-awarded-amount" className="text-2xl font-bold">
                  {pointsAwarded.toLocaleString()}
                </span>
                <span className="text-muted-foreground">points</span>
              </div>
              <p className="text-xs text-muted-foreground">
                added to your account
              </p>
            </div>
            {txHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline mb-4 inline-block"
              >
                View transaction
              </a>
            )}
            <button
              onClick={handleClose}
              className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Done
            </button>
          </div>
        );

      case 'error':
        return (
          <div data-testid="payment-error" className="text-center py-8">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Payment Failed</h3>
            <p data-testid="payment-error-message" className="text-sm text-muted-foreground mb-6">
              {error || 'An error occurred during payment'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-3 bg-sidebar border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setStep('input');
                  setError(null);
                }}
                className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div
      data-testid="buy-points-modal-overlay"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        data-testid="buy-points-modal"
        className="bg-background border border-border rounded-xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <h2 className="text-xl font-bold">Buy Points</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            disabled={loading || step === 'payment' || step === 'verifying'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">{renderContent()}</div>
      </div>
    </div>
  );
}
