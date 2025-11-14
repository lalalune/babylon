import { useCallback } from 'react';

import type { OnboardingProfilePayload } from '@/lib/onboarding/types';
import {
  CAPABILITIES_HASH,
  getIdentityRegistryAddress,
  identityRegistryAbi,
} from '@/constants/identity';
import { useSmartWallet } from '@/hooks/useSmartWallet';
import { encodeFunctionData, createPublicClient, http, type Address } from 'viem';
import { CHAIN } from '@/constants/chains';
import { WALLET_ERROR_MESSAGES } from '@/lib/wallet-utils';

export function useRegisterAgentTx() {
  const {
    smartWalletAddress,
    smartWalletReady,
    sendSmartWalletTransaction,
  } = useSmartWallet();
  const registryAddress = getIdentityRegistryAddress();

  const registerAgent = useCallback(
    async (profile: OnboardingProfilePayload) => {
      if (!smartWalletReady || !smartWalletAddress) {
        throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET);
      }

      if (!profile.username) {
        throw new Error('Username is required to complete registration.');
      }

      const publicClient = createPublicClient({
        chain: CHAIN,
        transport: http(),
      });
      
      const isRegistered = await publicClient.readContract({
        address: registryAddress,
        abi: identityRegistryAbi,
        functionName: 'isRegistered',
        args: [smartWalletAddress as Address],
      });

      if (isRegistered) {
        throw new Error('Already registered - wallet is already registered on-chain');
      }

      const agentEndpoint = `https://babylon.market/agent/${smartWalletAddress.toLowerCase()}`;
      const metadataUri = JSON.stringify({
        name: profile.displayName ?? profile.username,
        username: profile.username,
        bio: profile.bio ?? '',
        type: 'user',
        registered: new Date().toISOString(),
      });

      const data = encodeFunctionData({
        abi: identityRegistryAbi,
        functionName: 'registerAgent',
        args: [profile.username, agentEndpoint, CAPABILITIES_HASH, metadataUri],
      });

      return await sendSmartWalletTransaction({
        to: registryAddress,
        data,
        value: 0n,
        chain: CHAIN,
      });
    },
    [
      smartWalletAddress,
      smartWalletReady,
      sendSmartWalletTransaction,
      registryAddress,
    ]
  );

  return { registerAgent, smartWalletAddress, smartWalletReady };
}
