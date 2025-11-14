import { useCallback, useEffect, useState } from 'react';

import type { Address } from 'viem';
import { createPublicClient, http } from 'viem';

import { useSmartWallet } from '@/hooks/useSmartWallet';

import { CHAIN, RPC_URL } from '@/constants/chains';

const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
});

export function useSmartWalletBalance() {
  const { smartWalletAddress } = useSmartWallet();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshBalance = useCallback(async () => {
    if (!smartWalletAddress) {
      setBalance(null);
      return null;
    }

    setLoading(true);
    const next = await publicClient.getBalance({
      address: smartWalletAddress as Address,
    });
    setBalance(next);
    setLoading(false);
    return next;
  }, [smartWalletAddress]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  return {
    balance,
    loading,
    refreshBalance,
  };
}
