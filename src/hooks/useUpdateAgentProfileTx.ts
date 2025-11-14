import { useCallback } from 'react';

import { encodeFunctionData } from 'viem';

import {
  CAPABILITIES_HASH,
  getIdentityRegistryAddress,
  identityRegistryAbi,
} from '@/constants/identity';
import { useSmartWallet } from '@/hooks/useSmartWallet';
import { CHAIN } from '@/constants/chains';
import { WALLET_ERROR_MESSAGES } from '@/lib/wallet-utils';

export interface AgentProfileMetadata {
  name: string;
  username?: string | null;
  bio?: string | null;
  profileImageUrl?: string | null;
  coverImageUrl?: string | null;
  type?: 'user' | string;
  updated?: string;
}

interface UpdateAgentProfileInput {
  metadata: AgentProfileMetadata;
  endpoint?: string;
}

export function useUpdateAgentProfileTx() {
  const {
    sendSmartWalletTransaction,
    smartWalletAddress,
    smartWalletReady,
  } = useSmartWallet();
  const registryAddress = getIdentityRegistryAddress();

  const updateAgentProfile = useCallback(
    async ({ metadata, endpoint }: UpdateAgentProfileInput) => {
      if (!smartWalletReady || !smartWalletAddress) {
        throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET);
      }

      const targetEndpoint =
        endpoint ??
        `https://babylon.game/agent/${smartWalletAddress.toLowerCase()}`;

      const metadataJson = JSON.stringify({
        ...metadata,
        type: metadata.type ?? 'user',
        updated: metadata.updated ?? new Date().toISOString(),
      });

      const data = encodeFunctionData({
        abi: identityRegistryAbi,
        functionName: 'updateAgent',
        args: [targetEndpoint, CAPABILITIES_HASH, metadataJson],
      });

      return await sendSmartWalletTransaction({
        to: registryAddress,
        data,
        value: 0n,
        chain: CHAIN,
      });
    },
    [
      registryAddress,
      sendSmartWalletTransaction,
      smartWalletAddress,
      smartWalletReady,
    ]
  );

  return {
    updateAgentProfile,
    smartWalletAddress,
    smartWalletReady,
  };
}
