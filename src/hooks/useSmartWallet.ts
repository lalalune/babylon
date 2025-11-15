import { useCallback, useMemo } from 'react';

import type { SmartWalletClientType } from '@privy-io/react-auth/smart-wallets';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import type { Hex } from 'viem';

import {
  WALLET_ERROR_MESSAGES,
  getWalletErrorMessage,
} from '@/lib/wallet-utils';
import { logger } from '@/lib/logger';

type SmartWalletTxInput = Parameters<
  SmartWalletClientType['sendTransaction']
>[0];
type SmartWalletTxOptions = Parameters<
  SmartWalletClientType['sendTransaction']
>[1];

interface UseSmartWalletResult {
  client?: SmartWalletClientType;
  smartWalletAddress?: string;
  smartWalletReady: boolean;
  sendSmartWalletTransaction: (
    input: SmartWalletTxInput,
    options?: SmartWalletTxOptions
  ) => Promise<Hex>;
}

export function useSmartWallet(): UseSmartWalletResult {
  const { client } = useSmartWallets();
  logger.debug('Smart wallet client initialized', { hasClient: !!client });
  const typedClient = client as SmartWalletClientType | undefined;
  const smartWalletAddress = typedClient?.account?.address;
  const smartWalletReady = useMemo(
    () => Boolean(typedClient && smartWalletAddress),
    [typedClient, smartWalletAddress]
  );

  const sendSmartWalletTransaction = useCallback(
    async (
      input: SmartWalletTxInput,
      options?: SmartWalletTxOptions
    ): Promise<Hex> => {
      if (!typedClient || !smartWalletAddress) {
        throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET);
      }

      try {
        return await typedClient.sendTransaction(input, options);
      } catch (error) {
        throw new Error(getWalletErrorMessage(error));
      }
    },
    [typedClient, smartWalletAddress]
  );

  return {
    client: typedClient,
    smartWalletAddress,
    smartWalletReady,
    sendSmartWalletTransaction,
  };
}
