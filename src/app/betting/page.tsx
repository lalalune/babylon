'use client';

/**
 * On-Chain Betting Page
 * 
 * Real betting with Base Sepolia ETH
 * Transactions execute on blockchain via smart wallet
 */

import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useOnChainBetting } from '@/hooks/useOnChainBetting';
import { useSmartWallet } from '@/hooks/useSmartWallet';
import { getContractAddresses } from '@/lib/deployment/addresses';
import { cn } from '@/lib/utils';
import { Clock, ExternalLink, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Question {
  id: number | string;
  text: string;
  status: 'active' | 'resolved' | 'cancelled';
  yesShares: number;
  noShares: number;
  resolutionDate?: string;
  oracleCommitTxHash?: string | null;
  oracleRevealTxHash?: string | null;
}

interface PerpMarket {
  ticker: string;
  name: string;
  currentPrice: number;
  change24h: number;
  changePercent24h: number;
}

export default function OnChainBettingPage() {
  const router = useRouter();
  const { authenticated, login } = useAuth();
  const { smartWalletReady, smartWalletAddress } = useSmartWallet();
  const { buyShares, loading: txLoading } = useOnChainBetting();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [perpMarkets, setPerpMarkets] = useState<PerpMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<Question | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [betSide, setBetSide] = useState<'YES' | 'NO'>('YES');
  
  // Get network info
  const { network, diamond, chainId } = getContractAddresses();
  const isLocal = chainId === 31337;
  const explorerUrl = isLocal 
    ? null // No explorer for localnet
    : chainId === 84532
      ? 'https://sepolia.basescan.org'
      : 'https://basescan.org';

  useEffect(() => {
    async function fetchData() {
      try {
        const [questionsRes, perpsRes] = await Promise.all([
          fetch('/api/markets/predictions'),
          fetch('/api/markets/perps'),
        ]);

        if (questionsRes.ok) {
          const data = await questionsRes.json();
          setQuestions(data.questions || []);
        }

        if (perpsRes.ok) {
          const data = await perpsRes.json();
          setPerpMarkets(data.markets || []);
        }
      } catch (error) {
        console.error('Failed to fetch betting data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleBet = async () => {
    if (!selectedMarket || !betAmount) return;

    const shares = parseFloat(betAmount);
    if (isNaN(shares) || shares <= 0) {
      toast.error('Invalid bet amount');
      return;
    }

    try {
      const result = await buyShares(
        selectedMarket.id.toString(),
        betSide,
        shares
      );

      toast.success('Bet placed on-chain!', {
        description: isLocal ? `TX: ${result.txHash.slice(0, 10)}...` : 'View on explorer',
        action: explorerUrl ? {
          label: 'View TX',
          onClick: () => window.open(`${explorerUrl}/tx/${result.txHash}`, '_blank')
        } : undefined
      });

      // Verify with backend
      await fetch(`/api/markets/predictions/${selectedMarket.id}/buy-onchain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side: betSide.toLowerCase(),
          numShares: shares,
          txHash: result.txHash,
          walletAddress: smartWalletAddress
        })
      });

      setSelectedMarket(null);
      setBetAmount('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bet failed');
    }
  };

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;
  
  const getDaysLeft = (date?: string) => {
    if (!date) return null;
    const diff = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  if (!authenticated) {
    return (
      <PageContainer>
        <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <div className="text-center space-y-3">
            <Wallet className="w-16 h-16 mx-auto text-[#0066FF]" />
            <h1 className="text-3xl font-bold">On-Chain Betting</h1>
            <p className="text-muted-foreground max-w-md">
              Bet with real Base Sepolia ETH. All transactions are on-chain and verifiable.
            </p>
          </div>
          <button
            onClick={login}
            className="px-8 py-3 bg-[#0066FF] text-primary-foreground rounded-lg font-medium hover:bg-[#2952d9] transition-colors"
          >
            Connect Wallet to Start Betting
          </button>
        </div>
      </PageContainer>
    );
  }

  if (!smartWalletReady) {
    return (
      <PageContainer>
        <div className="p-4 md:p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="p-4 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="p-4 md:p-6 space-y-8">
        {/* Header */}
        <div>
          <button
            onClick={() => router.push('/markets')}
            className="text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            ← Back to Markets
          </button>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">On-Chain Betting</h1>
          <p className="text-muted-foreground">
            {isLocal 
              ? `Local Anvil (Chain ID: ${chainId}) • Testing mode`
              : `Base Sepolia ETH • All transactions on blockchain`}
          </p>
          <div className="mt-1 text-xs text-muted-foreground">
            Network: {network} • Diamond: {diamond.slice(0, 10)}...{diamond.slice(-6)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Wallet className="w-4 h-4 text-green-600" />
            <span className="text-green-600 font-medium">Connected: {smartWalletAddress?.slice(0, 6)}...{smartWalletAddress?.slice(-4)}</span>
            {explorerUrl && (
              <a
                href={`${explorerUrl}/address/${smartWalletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0066FF] hover:underline flex items-center gap-1"
              >
                View Wallet <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Prediction Markets Section */}
        <section>
          <h2 className="text-xl font-bold mb-4">Prediction Markets - On-Chain</h2>
          <div className="space-y-3">
            {questions.filter(q => q.status === 'active').map((question) => {
              const totalShares = question.yesShares + question.noShares;
              const yesPercent = totalShares > 0 
                ? ((question.yesShares / totalShares) * 100).toFixed(1)
                : '50.0';
              const noPercent = totalShares > 0 
                ? ((question.noShares / totalShares) * 100).toFixed(1)
                : '50.0';
              const daysLeft = getDaysLeft(question.resolutionDate);

              return (
                <div
                  key={question.id}
                  className="bg-card border border-border rounded-lg p-4 hover:border-[#0066FF]/50 transition-colors"
                >
                  <div className="mb-3">
                    <h3 className="font-medium text-base mb-1">{question.text}</h3>
                    <div className="flex items-center gap-2 text-xs">
                      {question.oracleCommitTxHash && (
                        <span className="text-green-600 flex items-center gap-1">
                          ✓ Committed On-Chain
                        </span>
                      )}
                      {daysLeft !== null && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {daysLeft}d left
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-4">
                      <div className="text-sm">
                        <span className="text-green-600 font-bold">{yesPercent}%</span>
                        <span className="text-muted-foreground ml-1">YES</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-red-600 font-bold">{noPercent}%</span>
                        <span className="text-muted-foreground ml-1">NO</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedMarket(question);
                        setBetSide('YES');
                      }}
                      className="flex-1 px-4 py-2 bg-green-600/20 text-green-600 rounded-lg font-medium hover:bg-green-600/30 transition-colors"
                    >
                      Bet YES On-Chain
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMarket(question);
                        setBetSide('NO');
                      }}
                      className="flex-1 px-4 py-2 bg-red-600/20 text-red-600 rounded-lg font-medium hover:bg-red-600/30 transition-colors"
                    >
                      Bet NO On-Chain
                    </button>
                  </div>
                </div>
              );
            })}

            {questions.filter(q => q.status === 'active').length === 0 && (
              <div className="bg-muted/30 rounded-lg p-6 text-center">
                <p className="text-muted-foreground">No active prediction markets</p>
              </div>
            )}
          </div>
        </section>

        {/* Perpetual Markets Info */}
        <section>
          <h2 className="text-xl font-bold mb-4">Perpetual Futures - Price Data On-Chain</h2>
          <div className="space-y-3">
            {perpMarkets.slice(0, 5).map((market) => (
              <div
                key={market.ticker}
                className="bg-card border border-border rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">${market.ticker}</h3>
                    <p className="text-sm text-muted-foreground">{market.name}</p>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-bold text-lg">{formatPrice(market.currentPrice)}</div>
                    <div className={cn(
                      "text-sm font-bold flex items-center gap-1 justify-end",
                      market.change24h >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {market.change24h >= 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      {market.change24h >= 0 ? '+' : ''}{market.changePercent24h.toFixed(2)}%
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-green-600">
                  ✓ Prices published on-chain every tick
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Note: Perp trading is currently instant/off-chain. Prices are published on-chain for verification.
          </p>
        </section>

        {/* Bet Modal */}
        {selectedMarket && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full space-y-4">
              <div>
                <h3 className="text-lg font-bold mb-2">Place On-Chain Bet</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedMarket.text}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Betting: <span className={betSide === 'YES' ? 'text-green-600' : 'text-red-600'}>{betSide}</span>
                </label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="Number of shares"
                  className="w-full px-4 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-[#0066FF]"
                  step="0.1"
                  min="0.1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will execute a real blockchain transaction on Base Sepolia
                </p>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <p className="text-xs text-yellow-600">
                  ⚠️ This is a real on-chain transaction. Gas fees apply. Transaction will be visible on Base Sepolia block explorer.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedMarket(null);
                    setBetAmount('');
                  }}
                  disabled={txLoading}
                  className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBet}
                  disabled={txLoading || !betAmount}
                  className="flex-1 px-4 py-2 bg-[#0066FF] text-primary-foreground rounded-lg font-medium hover:bg-[#2952d9] transition-colors disabled:opacity-50"
                >
                  {txLoading ? 'Sending TX...' : 'Place Bet On-Chain'}
                </button>
              </div>

              {smartWalletAddress && (
                <div className="text-xs text-muted-foreground text-center">
                  Using wallet: {smartWalletAddress.slice(0, 6)}...{smartWalletAddress.slice(-4)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

