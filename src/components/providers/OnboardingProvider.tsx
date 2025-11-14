'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIdentityToken, usePrivy } from '@privy-io/react-auth';

import {
  type ImportedProfileData,
  OnboardingModal,
} from '@/components/onboarding/OnboardingModal';

import { apiFetch } from '@/lib/api/fetch';
import { logger } from '@/lib/logger';
import type { OnboardingProfilePayload } from '@/lib/onboarding/types';
import {
  WALLET_ERROR_MESSAGES,
  getWalletErrorMessage,
} from '@/lib/wallet-utils';

import { useAuth } from '@/hooks/useAuth';
import { useRegisterAgentTx } from '@/hooks/useRegisterAgentTx';

import { type User as StoreUser, useAuthStore } from '@/stores/authStore';

import { clearReferralCode, getReferralCode } from './ReferralCaptureProvider';

type OnboardingStage = 'PROFILE' | 'ONCHAIN' | 'COMPLETED';

function extractErrorMessage(error: Error | { message: string } | string): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Unknown error';
}

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    authenticated,
    user,
    needsOnboarding,
    needsOnchain,
    loadingProfile,
    refresh,
    logout,
  } = useAuth();

  const { user: privyUser } = usePrivy();

  const { setUser, setNeedsOnboarding, setNeedsOnchain } = useAuthStore();
  const { identityToken } = useIdentityToken();
  const { registerAgent, smartWalletAddress, smartWalletReady } =
    useRegisterAgentTx();

  const [stage, setStage] = useState<OnboardingStage>('PROFILE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedProfile, setSubmittedProfile] =
    useState<OnboardingProfilePayload | null>(null);
  const [userDismissed, setUserDismissed] = useState(false);
  const [importedProfileData, setImportedProfileData] =
    useState<ImportedProfileData | null>(null);
  const [hasProgressedPastSocialImport, setHasProgressedPastSocialImport] =
    useState(false);
  
  // Delay modal display to prevent flickering
  const [isReadyToShow, setIsReadyToShow] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Wait for app to stabilize before showing modal
  useEffect(() => {
    if (!authenticated || loadingProfile) {
      setIsReadyToShow(false);
      setHasInitialized(false);
      return;
    }

    // If already initialized and conditions change, show immediately
    if (hasInitialized) {
      setIsReadyToShow(true);
      return;
    }

    // First time: wait 2-3 seconds for app to load
    const delay = Math.random() * 1000 + 2000; // 2-3 seconds
    const timer = setTimeout(() => {
      setIsReadyToShow(true);
      setHasInitialized(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [authenticated, loadingProfile, hasInitialized]);

  const shouldShowModal = useMemo(() => {
    // Check if dev mode is enabled via URL parameter
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isDevMode = params.get('dev') === 'true';
      const isProduction = window.location.hostname === 'babylon.market';
      const isHomePage = window.location.pathname === '/';

      // Hide onboarding modal on production (babylon.market) on home page unless ?dev=true
      if (isProduction && isHomePage && !isDevMode) {
        return false;
      }
    }

    // Don't show until ready (prevents flickering)
    if (!isReadyToShow) {
      return false;
    }

    if (!authenticated || loadingProfile) {
      return false;
    }

    // User explicitly dismissed the modal
    if (userDismissed) {
      return false;
    }

    // Don't show modal if user is already fully registered (defensive check)
    if (user?.onChainRegistered && user?.nftTokenId && user?.profileComplete) {
      return false;
    }

    // Don't keep showing modal after completion
    if (stage === 'COMPLETED') {
      return true; // Show briefly to show success message, but allow closing
    }

    return Boolean(
      needsOnboarding ||
        needsOnchain ||
        stage === 'ONCHAIN' ||
        stage === 'PROFILE'
    );
  }, [
    isReadyToShow,
    authenticated,
    loadingProfile,
    needsOnboarding,
    needsOnchain,
    stage,
    user,
    userDismissed,
  ]);

  useEffect(() => {
    if (!authenticated) {
      setStage('PROFILE');
      setSubmittedProfile(null);
      setError(null);
      setUserDismissed(false); // Reset dismissed state on logout
      setImportedProfileData(null);
      setHasProgressedPastSocialImport(false);
      return;
    }

    if (loadingProfile) {
      return;
    }

    if (needsOnboarding) {
      // Start directly at profile setup
      setStage('PROFILE');
      return;
    }

    if (needsOnchain) {
      if (!submittedProfile && user) {
        setSubmittedProfile({
          username: user.username ?? `user_${user.id.slice(0, 8)}`,
          displayName: user.displayName ?? user.username ?? 'New User',
          bio: user.bio ?? undefined,
          profileImageUrl: user.profileImageUrl ?? undefined,
          coverImageUrl: user.coverImageUrl ?? undefined,
        });
      }
      setStage((prev) => (prev === 'COMPLETED' ? prev : 'ONCHAIN'));
      return;
    }

    if (stage !== 'COMPLETED') {
      setStage('PROFILE');
      setSubmittedProfile(null);
      setError(null);
      setImportedProfileData(null);
      setHasProgressedPastSocialImport(false);
    }
  }, [
    authenticated,
    loadingProfile,
    needsOnboarding,
    needsOnchain,
    user,
    submittedProfile,
    stage,
    hasProgressedPastSocialImport,
  ]);

  // Automatically extract social profile data from Privy user when authenticating
  useEffect(() => {
    if (!authenticated || !privyUser || !needsOnboarding) return;
    if (importedProfileData) return; // Already have imported data
    if (loadingProfile) return; // Wait for profile to load

    const userWithFarcaster = privyUser as typeof privyUser & {
      farcaster?: { 
        username?: string; 
        displayName?: string;
        bio?: string;
        pfp?: string;
        pfpUrl?: string;
        fid?: number;
        url?: string;
        ownerAddress?: string;
        verifications?: string[];
      };
    };
    const userWithTwitter = privyUser as typeof privyUser & {
      twitter?: { 
        username?: string;
        name?: string;
        profilePictureUrl?: string;
        subject?: string; // Twitter user ID
      };
    };

    // Check if user authenticated with Farcaster
    if (userWithFarcaster.farcaster) {
      const fc = userWithFarcaster.farcaster;
      
      // Use pfpUrl or pfp, whichever is available
      const profileImage = fc.pfpUrl || fc.pfp || null;
      
      const profileData: ImportedProfileData = {
        platform: 'farcaster',
        username: fc.username || fc.displayName?.toLowerCase().replace(/\s+/g, '_') || 'farcaster_user',
        displayName: fc.displayName || fc.username || 'Farcaster User',
        bio: fc.bio || undefined,
        profileImageUrl: profileImage,
        farcasterFid: fc.fid?.toString(),
      };

      logger.info(
        'Auto-imported Farcaster profile from Privy - will award points on signup',
        { 
          username: profileData.username,
          displayName: profileData.displayName,
          fid: fc.fid,
          hasBio: !!profileData.bio,
          hasProfileImage: !!profileImage,
          rewardEligible: true,
          expectedPoints: 1000 // FARCASTER_LINK points
        },
        'OnboardingProvider'
      );

      setImportedProfileData(profileData);
      setHasProgressedPastSocialImport(true);
      return;
    }

    // Check if user authenticated with Twitter
    if (userWithTwitter.twitter) {
      const tw = userWithTwitter.twitter;
      
      // Upgrade Twitter profile image to higher resolution if available
      let profileImageUrl = tw.profilePictureUrl;
      if (profileImageUrl && profileImageUrl.includes('_normal')) {
        profileImageUrl = profileImageUrl.replace('_normal', '_400x400');
      }
      
      const profileData: ImportedProfileData = {
        platform: 'twitter',
        username: tw.username || 'twitter_user',
        displayName: tw.name || tw.username || 'Twitter User',
        bio: undefined, // Twitter bio not directly available from Privy, would need separate API call
        profileImageUrl: profileImageUrl || null,
        twitterId: tw.subject || tw.username, // Use subject (Twitter user ID) if available
      };

      logger.info(
        'Auto-imported Twitter profile from Privy - will award points on signup',
        { 
          username: profileData.username,
          displayName: profileData.displayName,
          twitterId: profileData.twitterId,
          hasProfileImage: !!profileImageUrl,
          rewardEligible: true,
          expectedPoints: 1000 // TWITTER_LINK points
        },
        'OnboardingProvider'
      );

      setImportedProfileData(profileData);
      setHasProgressedPastSocialImport(true);
      return;
    }
    
    // For wallet-only logins, don't set imported data - let the generated profile flow handle it
    logger.info(
      'User authenticated with wallet only - will use generated profile',
      { userId: privyUser.id },
      'OnboardingProvider'
    );
  }, [authenticated, privyUser, needsOnboarding, importedProfileData, loadingProfile]);

  // Listen for social import callbacks from URL parameters (for manual social linking)
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !authenticated
    )
      return;

    const params = new URLSearchParams(window.location.search);
    const socialImport = params.get('social_import');
    const dataParam = params.get('data');

    if (socialImport && dataParam) {
      try {
        const profileData = JSON.parse(
          decodeURIComponent(dataParam)
        ) as ImportedProfileData;
        logger.info(
          'Social profile data received from URL',
          { platform: socialImport },
          'OnboardingProvider'
        );

        setImportedProfileData(profileData);
        setHasProgressedPastSocialImport(true);
        setStage('PROFILE');

        // Clean up URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('social_import');
        newUrl.searchParams.delete('data');
        window.history.replaceState({}, '', newUrl.toString());
      } catch (err) {
        logger.error(
          'Failed to parse social import data',
          { error: err },
          'OnboardingProvider'
        );
      }
    }
  }, [authenticated, stage]);

  const submitOnchain = useCallback(
    async (profile: OnboardingProfilePayload, referralCode: string | null) => {
      // Defensive check: skip if user is already fully registered
      if (
        user?.onChainRegistered &&
        user?.nftTokenId &&
        user?.profileComplete
      ) {
        logger.info(
          'User already fully registered, skipping onchain submission',
          { userId: user.id, nftTokenId: user.nftTokenId },
          'OnboardingProvider'
        );
        setNeedsOnboarding(false);
        setNeedsOnchain(false);
        setStage('COMPLETED');
        return;
      }

      const body = {
        walletAddress: smartWalletAddress ?? null,
        referralCode: referralCode ?? null,
      };

      const callEndpoint = async (payload: Record<string, string | null>) => {
        const response = await apiFetch('/api/users/onboarding/onchain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
          const rawError = data?.error;
          const message =
            (typeof rawError === 'string'
              ? rawError
              : typeof rawError?.message === 'string'
                ? rawError.message
                : null) ??
            `Failed to complete on-chain onboarding (status ${response.status})`;
          throw new Error(message);
        }
        return data as { onchain: Record<string, unknown>; user: StoreUser | null };
      };

      const applyResponse = (data: {
        onchain: Record<string, unknown>;
        user: StoreUser | null;
      }) => {
        if (data.user) {
          setUser({
            id: data.user.id,
            walletAddress: data.user.walletAddress ?? undefined,
            displayName: data.user.displayName ?? user?.displayName,
            email: user?.email,
            username: data.user.username ?? undefined,
            bio: data.user.bio ?? undefined,
            profileImageUrl: data.user.profileImageUrl ?? undefined,
            coverImageUrl: data.user.coverImageUrl ?? undefined,
            profileComplete: data.user.profileComplete ?? true,
            reputationPoints:
              data.user.reputationPoints ?? user?.reputationPoints,
            hasFarcaster: data.user.hasFarcaster ?? user?.hasFarcaster,
            hasTwitter: data.user.hasTwitter ?? user?.hasTwitter,
            farcasterUsername:
              data.user.farcasterUsername ?? user?.farcasterUsername,
            twitterUsername: data.user.twitterUsername ?? user?.twitterUsername,
            nftTokenId: data.user.nftTokenId ?? undefined,
            createdAt: data.user.createdAt ?? user?.createdAt,
            onChainRegistered:
              data.user.onChainRegistered ?? user?.onChainRegistered,
          });
        }
        setNeedsOnboarding(false);
        setNeedsOnchain(false);
        setStage('COMPLETED');
        void refresh().catch(() => undefined);
      };

      const completeWithClient = async () => {
        if (!smartWalletReady || !smartWalletAddress) {
          throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET);
        }

        logger.info(
          'Attempting client-signed on-chain registration',
          { address: smartWalletAddress },
          'OnboardingProvider'
        );

        // Check if wallet is already registered before submitting transaction
        // If already registered, the server will handle syncing the state
        const registrationResult = await registerAgent(profile).catch((txError: Error) => {
          const errorMessage = txError.message.toLowerCase();
          // If the error is "already registered", don't throw - let the server handle it
          if (errorMessage.includes('already registered')) {
            logger.info(
              'Wallet already registered on-chain, syncing with server',
              { address: smartWalletAddress },
              'OnboardingProvider'
            );
            return 'already-registered';
          }
          // For other errors, re-throw
          throw txError;
        });
        
        if (registrationResult === 'already-registered') {
          // Call the endpoint without a txHash - server will detect existing registration
          const data = await callEndpoint(body);
          applyResponse(data);
          return;
        }
        
        const txHash = registrationResult as string;
        logger.info(
          'Client-submitted on-chain registration transaction',
          { txHash },
          'OnboardingProvider'
        );
        
        const data = await callEndpoint({
          ...body,
          txHash,
        });
        applyResponse(data);
      };
      
      const response = await completeWithClient().catch((rawError: Error) => {
        // Use wallet-aware error message
        const userFriendlyMessage = getWalletErrorMessage(rawError);
        setError(userFriendlyMessage);
        logger.error(
          'Failed to complete on-chain onboarding',
          { error: rawError.message },
          'OnboardingProvider'
        );
        return null;
      });
      
      if (!response) return;
    },
    [
      smartWalletReady,
      refresh,
      registerAgent,
      setNeedsOnboarding,
      setNeedsOnchain,
      setUser,
      smartWalletAddress,
      user,
    ]
  );

  const handleProfileSubmit = useCallback(
    async (payload: OnboardingProfilePayload) => {
      setIsSubmitting(true);
      setError(null);

      const referralCode = getReferralCode();

      logger.info(
        'Identity token state during signup',
        {
          present: Boolean(identityToken),
          tokenPreview: identityToken
            ? `${identityToken.slice(0, 12)}...`
            : null,
        },
        'OnboardingProvider'
      );

      const response = await apiFetch('/api/users/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          referralCode: referralCode ?? undefined,
          identityToken: identityToken ?? undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const message =
          data?.error ||
          `Failed to complete signup (status ${response.status})`;
        setIsSubmitting(false);
        throw new Error(message);
      }

      if (data.user) {
        setUser({
          id: data.user.id,
          walletAddress:
            data.user.walletAddress ?? smartWalletAddress ?? undefined,
          displayName: data.user.displayName ?? payload.displayName,
          email: user?.email,
          username: data.user.username ?? payload.username,
          bio: data.user.bio ?? payload.bio,
          profileImageUrl:
            data.user.profileImageUrl ?? payload.profileImageUrl ?? undefined,
          coverImageUrl:
            data.user.coverImageUrl ?? payload.coverImageUrl ?? undefined,
          profileComplete: data.user.profileComplete ?? true,
          reputationPoints:
            data.user.reputationPoints ?? user?.reputationPoints,
          hasFarcaster: data.user.hasFarcaster ?? user?.hasFarcaster,
          hasTwitter: data.user.hasTwitter ?? user?.hasTwitter,
          farcasterUsername:
            data.user.farcasterUsername ?? user?.farcasterUsername,
          twitterUsername: data.user.twitterUsername ?? user?.twitterUsername,
          nftTokenId: data.user.nftTokenId ?? undefined,
          createdAt: data.user.createdAt ?? user?.createdAt,
          onChainRegistered:
            data.user.onChainRegistered ?? user?.onChainRegistered,
        });
      }
      setNeedsOnboarding(false);
      setNeedsOnchain(true);

      clearReferralCode();
      setSubmittedProfile(payload);
      setStage('ONCHAIN');

      await submitOnchain(payload, referralCode);
      setIsSubmitting(false);
    },
    [
      submitOnchain,
      user,
      setUser,
      setNeedsOnboarding,
      setNeedsOnchain,
      identityToken,
      smartWalletAddress,
    ]
  );

  const handleRetryOnchain = useCallback(async () => {
    if (!submittedProfile) return;
    setIsSubmitting(true);
    setError(null);

    await submitOnchain(submittedProfile, getReferralCode()).catch((rawError: Error) => {
      const message = extractErrorMessage(rawError);
      setError(message);
      logger.error(
        'Failed to retry on-chain onboarding',
        { error: rawError.message },
        'OnboardingProvider'
      );
    });
    setIsSubmitting(false);
  }, [submittedProfile, submitOnchain]);

  const handleSkipOnchain = useCallback(() => {
    logger.info(
      'User skipped onchain registration',
      { userId: user?.id },
      'OnboardingProvider'
    );
    setNeedsOnchain(false);
    setUserDismissed(true);
    setStage('PROFILE');
    setSubmittedProfile(null);
    setError(null);
    setImportedProfileData(null);
  }, [user, setNeedsOnchain]);

  const handleClose = useCallback(() => {
    logger.info(
      'User closed onboarding modal',
      {
        stage,
        needsOnboarding,
        needsOnchain,
        userRegistered: user?.onChainRegistered,
      },
      'OnboardingProvider'
    );

    setUserDismissed(true);
    setStage('PROFILE');
    setSubmittedProfile(null);
    setError(null);
    setImportedProfileData(null);
    setHasProgressedPastSocialImport(false);

    // Clear onboarding flags so modal doesn't keep reappearing
    setNeedsOnboarding(false);
    setNeedsOnchain(false);
  }, [
    stage,
    needsOnboarding,
    needsOnchain,
    user,
    setNeedsOnboarding,
    setNeedsOnchain,
  ]);

  return (
    <>
      {children}
      {shouldShowModal && (
        <OnboardingModal
          isOpen
          stage={stage}
          isSubmitting={isSubmitting}
          error={error}
          onSubmitProfile={handleProfileSubmit}
          onRetryOnchain={handleRetryOnchain}
          onSkipOnchain={handleSkipOnchain}
          onClose={handleClose}
          onLogout={logout}
          user={user}
          importedData={importedProfileData}
        />
      )}
    </>
  );
}
