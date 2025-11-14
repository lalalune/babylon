'use client';

import { useEffect, useMemo } from 'react';

import {
  type ConnectedWallet,
  type User as PrivyUser,
  usePrivy,
  useWallets,
} from '@privy-io/react-auth';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';

import { apiFetch } from '@/lib/api/fetch';
import { logger } from '@/lib/logger';

import { type User, useAuthStore } from '@/stores/authStore';

interface UseAuthReturn {
  ready: boolean;
  authenticated: boolean;
  loadingProfile: boolean;
  user: User | null;
  wallet: ConnectedWallet | undefined;
  smartWalletAddress?: string;
  smartWalletReady: boolean;
  needsOnboarding: boolean;
  needsOnchain: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

let lastSyncedWalletAddress: string | null = null;

// Global fetch management - shared across ALL useAuth instances
let globalFetchInFlight: Promise<void> | null = null;
let globalTokenRetryTimeout: number | null = null;

// Track users for whom social accounts have been linked in this session
const linkedSocialUsers = new Set<string>();

export function useAuth(): UseAuthReturn {
  const {
    ready,
    authenticated,
    user: privyUser,
    login,
    logout,
    getAccessToken,
  } = usePrivy();
  const { wallets } = useWallets();
  const { client } = useSmartWallets();
  const {
    user,
    isLoadingProfile,
    needsOnboarding,
    needsOnchain,
    setUser,
    setWallet,
    setNeedsOnboarding,
    setNeedsOnchain,
    setLoadedUserId,
    setIsLoadingProfile,
    clearAuth,
  } = useAuthStore();

  // Prioritize embedded Privy wallets for gas sponsorship
  // Embedded wallets enable gasless transactions via Privy's paymaster
  // External wallets can be used, but users must pay their own gas
  const wallet = useMemo(() => {
    if (wallets.length === 0) return undefined;

    // First, try to find the Privy embedded wallet for gas sponsorship
    const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
    if (embeddedWallet) return embeddedWallet;

    // If no embedded wallet, fall back to external wallet (user pays gas)
    return wallets[0];
  }, [wallets]);

  const smartWalletAddress = client?.account?.address;
  const smartWalletReady = Boolean(smartWalletAddress);

  const persistAccessToken = async (): Promise<string | null> => {
    if (!authenticated) {
      if (typeof window !== 'undefined') {
        window.__privyAccessToken = null;
      }
      return null;
    }

    try {
      const token = await getAccessToken();
      if (typeof window !== 'undefined') {
        window.__privyAccessToken = token;
      }
      return token ?? null;
    } catch (error) {
      logger.warn('Failed to obtain Privy access token', { error }, 'useAuth');
      return null;
    }
  };

  const fetchCurrentUser = async () => {
    if (!authenticated || !privyUser) return;

    // Use global ref to prevent ANY duplicate calls across all components
    if (globalFetchInFlight) {
      await globalFetchInFlight;
      return;
    }

    const run = async () => {
      setIsLoadingProfile(true);
      setLoadedUserId(privyUser.id);

      try {
        const token = await persistAccessToken();
        if (!token) {
          logger.warn(
            'Privy access token unavailable; delaying /api/users/me fetch',
            { userId: privyUser.id },
            'useAuth'
          );
          setIsLoadingProfile(false);
          if (typeof window !== 'undefined') {
            if (globalTokenRetryTimeout) {
              window.clearTimeout(globalTokenRetryTimeout);
            }
            globalTokenRetryTimeout = window.setTimeout(() => {
              void fetchCurrentUser();
            }, 200);
          }
          return;
        }

        const response = await apiFetch('/api/users/me');
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message =
            data?.error ||
            `Failed to load authenticated user (status ${response.status})`;
          throw new Error(message);
        }

        const me = data as {
          authenticated: boolean;
          needsOnboarding: boolean;
          needsOnchain: boolean;
          user: (User & { createdAt?: string; updatedAt?: string }) | null;
        };

        setNeedsOnboarding(me.needsOnboarding);
        setNeedsOnchain(me.needsOnchain);

        const fallbackProfileImageUrl = user?.profileImageUrl;
        const fallbackCoverImageUrl = user?.coverImageUrl;

        if (me.user) {
          const hydratedUser: User = {
            id: me.user.id,
            walletAddress:
              me.user.walletAddress ?? smartWalletAddress ?? wallet?.address,
            displayName:
              me.user.displayName && me.user.displayName.trim() !== ''
                ? me.user.displayName
                : privyUser.email?.address ||
                  wallet?.address ||
                  'Anonymous',
            email: privyUser.email?.address,
            username: me.user.username ?? undefined,
            bio: me.user.bio ?? undefined,
            profileImageUrl:
              me.user.profileImageUrl ?? fallbackProfileImageUrl ?? undefined,
            coverImageUrl:
              me.user.coverImageUrl ?? fallbackCoverImageUrl ?? undefined,
            profileComplete: me.user.profileComplete ?? false,
            reputationPoints: me.user.reputationPoints ?? undefined,
            referralCount: undefined,
            referralCode: me.user.referralCode ?? undefined,
            hasFarcaster: me.user.hasFarcaster ?? undefined,
            hasTwitter: me.user.hasTwitter ?? undefined,
            farcasterUsername: me.user.farcasterUsername ?? undefined,
            twitterUsername: me.user.twitterUsername ?? undefined,
            showTwitterPublic: me.user.showTwitterPublic ?? undefined,
            showFarcasterPublic: me.user.showFarcasterPublic ?? undefined,
            showWalletPublic: me.user.showWalletPublic ?? undefined,
            stats: undefined,
            nftTokenId: me.user.nftTokenId ?? undefined,
            createdAt: me.user.createdAt,
            onChainRegistered: me.user.onChainRegistered ?? undefined,
          };

          // Only update if data has actually changed (prevent infinite re-render loop)
          const hasChanged =
            !user ||
            user.id !== hydratedUser.id ||
            user.username !== hydratedUser.username ||
            user.displayName !== hydratedUser.displayName ||
            user.profileComplete !== hydratedUser.profileComplete ||
            user.onChainRegistered !== hydratedUser.onChainRegistered ||
            user.profileImageUrl !== hydratedUser.profileImageUrl ||
            user.coverImageUrl !== hydratedUser.coverImageUrl ||
            user.bio !== hydratedUser.bio ||
            user.walletAddress !== hydratedUser.walletAddress ||
            user.showTwitterPublic !== hydratedUser.showTwitterPublic ||
            user.showFarcasterPublic !== hydratedUser.showFarcasterPublic ||
            user.showWalletPublic !== hydratedUser.showWalletPublic;

          if (hasChanged) {
            setUser(hydratedUser);
          }
        } else {
          // Only set user if not already set to prevent re-render loops
          if (!user || user.id !== privyUser.id) {
            setUser({
              id: privyUser.id,
              walletAddress: wallet?.address,
              displayName:
                privyUser.email?.address ?? wallet?.address ?? 'Anonymous',
              email: privyUser.email?.address,
              onChainRegistered: false,
            });
          }
        }
      } catch (error) {
        logger.error(
          'Failed to resolve authenticated user via /api/users/me',
          { error },
          'useAuth'
        );
        setNeedsOnboarding(true);
        setNeedsOnchain(false);

        // Only set user if not already set to prevent re-render loops
        if (!user || user.id !== privyUser.id) {
          setUser({
            id: privyUser.id,
            walletAddress: wallet?.address,
            displayName:
              privyUser.email?.address ?? wallet?.address ?? 'Anonymous',
            email: privyUser.email?.address,
            profileImageUrl: user?.profileImageUrl ?? undefined,
            coverImageUrl: user?.coverImageUrl ?? undefined,
            onChainRegistered: false,
          });
        }
      } finally {
        setIsLoadingProfile(false);
      }
    };

    const promise = run().finally(() => {
      globalFetchInFlight = null;
      if (typeof window !== 'undefined' && globalTokenRetryTimeout) {
        window.clearTimeout(globalTokenRetryTimeout);
        globalTokenRetryTimeout = null;
      }
    });

    globalFetchInFlight = promise;
    await promise;
  };

  const synchronizeWallet = () => {
    if (!wallet) return;
    if (wallet.address === lastSyncedWalletAddress) return;

    lastSyncedWalletAddress = wallet.address;
    setWallet({
      address: wallet.address,
      chainId: wallet.chainId,
    });
  };

  const linkSocialAccounts = async () => {
    if (!authenticated || !privyUser) return;
    if (isLoadingProfile) return; // Wait for profile to load
    if (needsOnboarding || needsOnchain) return;
    if (linkedSocialUsers.has(privyUser.id)) return;

    const token = await getAccessToken();
    if (!token) return;

    linkedSocialUsers.add(privyUser.id);

    const userWithFarcaster = privyUser as PrivyUser & {
      farcaster?: { username?: string; displayName?: string };
    };
    const userWithTwitter = privyUser as PrivyUser & {
      twitter?: { username?: string };
    };

    try {
      if (userWithFarcaster.farcaster) {
        const farcaster = userWithFarcaster.farcaster;
        await apiFetch(
          `/api/users/${encodeURIComponent(privyUser.id)}/link-social`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              platform: 'farcaster',
              username: farcaster.username || farcaster.displayName,
            }),
          }
        );
        logger.info(
          'Linked Farcaster account during auth sync',
          { username: farcaster.username },
          'useAuth'
        );
      }

      if (userWithTwitter.twitter) {
        const twitter = userWithTwitter.twitter;
        await apiFetch(
          `/api/users/${encodeURIComponent(privyUser.id)}/link-social`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              platform: 'twitter',
              username: twitter.username,
            }),
          }
        );
        logger.info(
          'Linked Twitter account during auth sync',
          { username: twitter.username },
          'useAuth'
        );
      }

      if (wallet?.address) {
        await apiFetch(
          `/api/users/${encodeURIComponent(privyUser.id)}/link-social`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              platform: 'wallet',
              address: wallet.address.toLowerCase(),
            }),
          }
        );
        logger.info(
          'Linked wallet during auth sync',
          { address: wallet.address },
          'useAuth'
        );
      }
    } catch (error) {
      logger.warn('Failed to auto-link social accounts', { error }, 'useAuth');
    }
  };

  useEffect(() => {
    void persistAccessToken();
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && globalTokenRetryTimeout) {
        window.clearTimeout(globalTokenRetryTimeout);
        globalTokenRetryTimeout = null;
      }
    };
  }, []);

  // Expose getAccessToken to window for use by apiFetch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as typeof window & { __privyGetAccessToken?: () => Promise<string | null> }).__privyGetAccessToken = getAccessToken;
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as typeof window & { __privyGetAccessToken?: () => Promise<string | null> }).__privyGetAccessToken = undefined;
      }
    };
  }, [getAccessToken]);

  // Sync wallet separately from fetching user
  useEffect(() => {
    if (authenticated && privyUser) {
      synchronizeWallet();
    }
  }, [authenticated, privyUser, wallet?.address, wallet?.chainId]);

  // Fetch user only when authentication status or user ID changes
  useEffect(() => {
    if (!authenticated || !privyUser) {
      linkedSocialUsers.delete(privyUser?.id ?? '');
      lastSyncedWalletAddress = null;
      clearAuth();
      // Clear any stale localStorage cache
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('babylon-auth');
          if (stored) {
            const parsed = JSON.parse(stored);
            // Clear if it's for a different user
            if (
              parsed.state?.user?.id &&
              privyUser &&
              parsed.state.user.id !== privyUser.id
            ) {
              logger.info(
                'Clearing stale auth cache for different user',
                {
                  cachedUserId: parsed.state.user.id,
                  currentUserId: privyUser?.id,
                },
                'useAuth'
              );
              localStorage.removeItem('babylon-auth');
            }
          }
        } catch (e) {
          logger.warn(
            'Failed to check localStorage cache',
            { error: e },
            'useAuth'
          );
        }
      }
      return;
    }

    void fetchCurrentUser();
  }, [authenticated, privyUser?.id]);

  useEffect(() => {
    void linkSocialAccounts();
  }, [
    authenticated,
    privyUser?.id,
    wallet?.address,
    needsOnboarding,
    isLoadingProfile,
  ]);

  const refresh = async () => {
    if (!authenticated || !privyUser) return;
    await fetchCurrentUser();
  };

  const handleLogout = async () => {
    await logout();
    clearAuth();
    if (typeof window !== 'undefined') {
      window.__privyAccessToken = null;
    }
  };

  return {
    ready,
    authenticated,
    loadingProfile: isLoadingProfile,
    user,
    wallet,
    smartWalletAddress: smartWalletAddress ?? undefined,
    smartWalletReady,
    needsOnboarding,
    needsOnchain,
    login,
    logout: handleLogout,
    refresh,
    getAccessToken,
  };
}
