import type { PrivyClientConfig } from '@privy-io/react-auth';

import { base, baseSepolia, mainnet, sepolia } from 'viem/chains';

/**
 * Extended Privy client config that includes "system" theme support
 * Privy supports "system" theme at runtime, but the types don't reflect this yet
 */
type ExtendedAppearance = Omit<
  NonNullable<PrivyClientConfig['appearance']>,
  'theme'
> & {
  theme?: 'light' | 'dark' | `#${string}` | 'system';
};

export interface ExtendedPrivyClientConfig
  extends Omit<PrivyClientConfig, 'appearance' | 'embeddedWallets'> {
  appearance?: ExtendedAppearance;
  embeddedWallets?: {
    ethereum?: {
      createOnLogin?: 'all-users' | 'users-without-wallets' | 'off';
    };
    solana?: {
      createOnLogin?: 'all-users' | 'users-without-wallets' | 'off';
    };
    disableAutomaticMigration?: boolean;
    showWalletUIs?: boolean;
  };
}

// Privy configuration
export const privyConfig: {
  appId: string;
  config: ExtendedPrivyClientConfig;
} = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',
  config: {
    appearance: {
      theme: 'dark' as const,
      accentColor: '#0066FF',
      logo: '/assets/logos/logo.svg',
      showWalletLoginFirst: false, // Changed to false to prioritize Farcaster
      walletList: [
        'metamask',
        'rabby_wallet',
        'detected_wallets',
        'rainbow',
        'coinbase_wallet',
      ],
      walletChainType: 'ethereum-only' as const,
    } satisfies ExtendedAppearance,
    // Prioritize Farcaster login for Mini Apps
    // Reference: https://docs.privy.io/recipes/farcaster/mini-apps
    loginMethods: ['farcaster', 'wallet', 'email'],
    embeddedWallets: {
      // Embedded wallets are created manually post-auth (see FarcasterFrameProvider)
      // Automatic creation is disabled to stay compatible with Farcaster Mini Apps
      ethereum: {
        createOnLogin: 'off' as const,
      },
      // Explicitly disable Solana to prevent warnings
      solana: {
        createOnLogin: 'off' as const,
      },
    },
    defaultChain: baseSepolia,
    // Wallet configuration - supports all chains including Base L2
    supportedChains: [base, baseSepolia, mainnet, sepolia],
    // WalletConnect configuration removed - configure NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env if needed
    ...(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID && {
      walletConnectCloudProjectId:
        process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    }),
  },
};
