'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Sparkles, RefreshCw, Upload, Check, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api/fetch'
import type { OnboardingProfilePayload } from '@/lib/onboarding/types'
import { logger } from '@/lib/logger'
import { SocialImportStep } from './SocialImportStep'
import { BouncingLogo } from '@/components/shared/BouncingLogo'

export interface ImportedProfileData {
  platform: 'twitter' | 'farcaster'
  username: string
  displayName: string
  bio?: string
  profileImageUrl?: string | null
  coverImageUrl?: string | null
  // Platform-specific IDs
  twitterId?: string
  farcasterFid?: string
}

interface OnboardingModalProps {
  isOpen: boolean
  stage: 'SOCIAL_IMPORT' | 'PROFILE' | 'ONCHAIN' | 'COMPLETED'
  isSubmitting: boolean
  error?: string | null
  onSubmitProfile: (payload: OnboardingProfilePayload) => Promise<void>
  onRetryOnchain: () => Promise<void>
  onSkipOnchain: () => void
  onSocialImport: (platform: 'twitter' | 'farcaster') => Promise<void>
  onSkipSocialImport: () => void
  onClose: () => void
  user: {
    id?: string
    username?: string
    walletAddress?: string
    onChainRegistered?: boolean
  } | null
  importedData?: ImportedProfileData | null
}

interface GeneratedProfileResponse {
  name: string
  username: string
  bio: string
}

interface RandomAssetsResponse {
  profilePictureIndex: number
  bannerIndex: number
}

const TOTAL_PROFILE_PICTURES = 100
const TOTAL_BANNERS = 100
const ABSOLUTE_URL_PATTERN = /^(https?:|data:|blob:)/i

function resolveAssetUrl(value?: string | null): string | undefined {
  if (!value) return undefined
  if (ABSOLUTE_URL_PATTERN.test(value)) {
    return value
  }
  if (typeof window !== 'undefined' && value.startsWith('/')) {
    return new URL(value, window.location.origin).toString()
  }
  return value
}

export function OnboardingModal({
  isOpen,
  stage,
  isSubmitting,
  error,
  onSubmitProfile,
  onRetryOnchain,
  onSkipOnchain,
  onSocialImport,
  onSkipSocialImport,
  onClose,
  user,
  importedData,
}: OnboardingModalProps) {
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [profilePictureIndex, setProfilePictureIndex] = useState(1)
  const [bannerIndex, setBannerIndex] = useState(1)
  const [uploadedProfileImage, setUploadedProfileImage] = useState<string | null>(null)
  const [uploadedBanner, setUploadedBanner] = useState<string | null>(null)
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'available' | 'taken' | null>(null)
  const [usernameSuggestion, setUsernameSuggestion] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(true)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const currentProfileImage = useMemo(() => {
    return uploadedProfileImage || `/assets/user-profiles/profile-${profilePictureIndex}.jpg`
  }, [uploadedProfileImage, profilePictureIndex])

  const currentBanner = useMemo(() => {
    return uploadedBanner || `/assets/user-banners/banner-${bannerIndex}.jpg`
  }, [uploadedBanner, bannerIndex])

  // Pre-fill form with imported social data
  useEffect(() => {
    if (!importedData || stage !== 'PROFILE') return

    logger.info('Pre-filling profile with imported data', { platform: importedData.platform }, 'OnboardingModal')

    setDisplayName(importedData.displayName)
    setUsername(importedData.username)
    setBio(importedData.bio || '')
    
    // If we have a profile image URL from social import, use it
    if (importedData.profileImageUrl) {
      setUploadedProfileImage(importedData.profileImageUrl)
    }
    
    // If we have a cover/banner URL from social import, use it
    if (importedData.coverImageUrl) {
      setUploadedBanner(importedData.coverImageUrl)
    }
  }, [importedData, stage])

  useEffect(() => {
    if (!isOpen || stage === 'SOCIAL_IMPORT') return
    
    // Don't auto-generate if we have imported data
    if (importedData) {
      setIsLoadingDefaults(false)
      return
    }

    const initializeProfile = async () => {
      setIsLoadingDefaults(true)

      try {
        const [profileResult, assetsResult] = await Promise.allSettled([
          apiFetch('/api/onboarding/generate-profile', { auth: false }),
          apiFetch('/api/onboarding/random-assets', { auth: false }),
        ])

        if (profileResult.status === 'fulfilled' && profileResult.value.ok) {
          const generated = (await profileResult.value.json()) as GeneratedProfileResponse
          setDisplayName(generated.name)
          setUsername(generated.username)
          setBio(generated.bio)
        } else {
          setDisplayName('New Babylonian')
          setUsername(`user_${Math.random().toString(36).slice(2, 10)}`)
          setBio('Just joined Babylon!')
        }

        if (assetsResult.status === 'fulfilled' && assetsResult.value.ok) {
          const assets = (await assetsResult.value.json()) as RandomAssetsResponse
          setProfilePictureIndex(assets.profilePictureIndex)
          setBannerIndex(assets.bannerIndex)
        } else {
          setProfilePictureIndex(Math.floor(Math.random() * TOTAL_PROFILE_PICTURES) + 1)
          setBannerIndex(Math.floor(Math.random() * TOTAL_BANNERS) + 1)
        }
      } catch (initError) {
        logger.warn('Failed to initialize onboarding defaults', { error: initError }, 'OnboardingModal')
        setDisplayName('New Babylonian')
        setUsername(`user_${Math.random().toString(36).slice(2, 10)}`)
        setBio('Just joined Babylon!')
        setProfilePictureIndex(Math.floor(Math.random() * TOTAL_PROFILE_PICTURES) + 1)
        setBannerIndex(Math.floor(Math.random() * TOTAL_BANNERS) + 1)
      } finally {
        setUploadedProfileImage(null)
        setUploadedBanner(null)
        setIsLoadingDefaults(false)
      }
    }

    void initializeProfile()
  }, [isOpen, stage, importedData])

  useEffect(() => {
    if (stage !== 'PROFILE') return
    if (!username || username.length < 3) {
      setUsernameStatus(null)
      setUsernameSuggestion(null)
      return
    }

    let cancelled = false

    const checkUsername = async () => {
      setIsCheckingUsername(true)
      let status: 'available' | 'taken' | null = null
      let suggestion: string | null = null

      try {
        const response = await apiFetch(`/api/onboarding/check-username?username=${encodeURIComponent(username)}`, { auth: false })
        if (response.ok) {
          const result = (await response.json()) as { available?: boolean; suggestion?: string }
          status = result.available ? 'available' : 'taken'
          suggestion = result.available ? null : result.suggestion ?? null
        } else {
          const body = await response.json().catch(() => null)
          logger.warn('Username availability check failed', { status: response.status, body }, 'OnboardingModal')
        }
      } catch (checkError) {
        logger.warn('Username availability check error', { error: checkError }, 'OnboardingModal')
      }

      if (!cancelled) {
        setUsernameStatus(status)
        setUsernameSuggestion(suggestion)
        setIsCheckingUsername(false)
      }
    }

    void checkUsername()

    return () => {
      cancelled = true
    }
  }, [username, stage])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (stage !== 'PROFILE' || isSubmitting) return

    setFormError(null)

    if (!displayName.trim()) {
      setFormError('Please enter a display name')
      return
    }

    if (!username.trim() || username.length < 3) {
      setFormError('Please pick a username of at least 3 characters')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setFormError('Username can only contain letters, numbers, and underscores')
      return
    }

    if (usernameStatus === 'taken') {
      setFormError('Username is already taken. Please choose another.')
      return
    }

    if (!acceptedTerms) {
      setFormError('Please accept the Terms of Service and Privacy Policy to continue')
      return
    }

    const profilePayload: OnboardingProfilePayload = {
      username: username.trim().toLowerCase(),
      displayName: displayName.trim(),
      bio: bio.trim() || undefined,
      profileImageUrl: resolveAssetUrl(uploadedProfileImage ?? `/assets/user-profiles/profile-${profilePictureIndex}.jpg`),
      coverImageUrl: resolveAssetUrl(uploadedBanner ?? `/assets/user-banners/banner-${bannerIndex}.jpg`),
      // Include imported social account data if available
      importedFrom: importedData?.platform || null,
      twitterId: importedData?.platform === 'twitter' ? importedData.twitterId : null,
      twitterUsername: importedData?.platform === 'twitter' ? importedData.username : null,
      farcasterFid: importedData?.platform === 'farcaster' ? importedData.farcasterFid : null,
      farcasterUsername: importedData?.platform === 'farcaster' ? importedData.username : null,
      // Legal acceptance
      tosAccepted: acceptedTerms,
      privacyPolicyAccepted: acceptedTerms,
    }

    await onSubmitProfile(profilePayload)
  }

  const renderProfileForm = () => (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium">Profile Banner</label>
        <div className="relative h-40 bg-muted rounded-lg overflow-hidden group">
          <Image
            src={currentBanner}
            alt="Profile banner"
            fill
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button type="button" onClick={() => cycleBanner('prev')} className="p-2 bg-background/80 hover:bg-background rounded-lg">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <label className="p-2 bg-background/80 hover:bg-background rounded-lg cursor-pointer">
              <Upload className="w-5 h-5" />
              <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
            </label>
            <button type="button" onClick={() => cycleBanner('next')} className="p-2 bg-background/80 hover:bg-background rounded-lg">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Click arrows to browse or upload your own</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Profile Picture</label>
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-muted group">
            <Image
              src={currentProfileImage}
              alt="Profile picture"
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <label className="p-2 bg-background/80 hover:bg-background rounded-lg cursor-pointer">
                <Upload className="w-4 h-4" />
                <input type="file" accept="image/*" onChange={handleProfileImageUpload} className="hidden" />
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => cycleProfilePicture('prev')} className="p-2 bg-muted hover:bg-muted/70 rounded-lg">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => cycleProfilePicture('next')} className="p-2 bg-muted hover:bg-muted/70 rounded-lg">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground flex-1">
            Browse through {TOTAL_PROFILE_PICTURES} AI-generated images or upload your own
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="displayName" className="block text-sm font-medium">
          Display Name
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your display name"
          className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
          maxLength={50}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="username" className="block text-sm font-medium">
          Username
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your handle"
            className="w-full pl-8 pr-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
            maxLength={20}
          />
          {isCheckingUsername && (
            <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
          {usernameStatus === 'available' && !isCheckingUsername && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
          )}
          {usernameStatus === 'taken' && !isCheckingUsername && (
            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
          )}
        </div>
        {usernameStatus === 'taken' && usernameSuggestion && (
          <p className="text-xs text-muted-foreground">
            Suggestion:{' '}
            <button type="button" className="underline" onClick={() => setUsername(usernameSuggestion)}>
              {usernameSuggestion}
            </button>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="bio" className="block text-sm font-medium">
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell the world who you are"
          rows={3}
          maxLength={280}
          className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
        />
        <p className="text-xs text-muted-foreground text-right">{bio.length}/280</p>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-border text-[#0066FF] focus:ring-2 focus:ring-[#0066FF] focus:ring-offset-0"
          />
          <span className="text-sm text-muted-foreground group-hover:text-foreground">
            I accept the{' '}
            <a
              href="https://docs.babylon.market/legal/terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0066FF] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Terms of Service
            </a>
            {' '}and{' '}
            <a
              href="https://docs.babylon.market/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0066FF] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Privacy Policy
            </a>
          </span>
        </label>
      </div>

      {(formError || error) && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{formError || error}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          onClick={handleSkip}
          disabled={isSubmitting}
          title="Use generated profile and continue"
        >
          Use Generated Profile
        </button>
        <div className="flex gap-2">
          <button
            type="submit"
            className={cn(
              'px-4 py-2 bg-[#0066FF] text-white rounded-lg flex items-center gap-2 hover:bg-[#0066FF]/90',
              isSubmitting && 'opacity-60'
            )}
            disabled={isSubmitting}
          >
            {isSubmitting && <BouncingLogo size={16} />}
            {isSubmitting ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </form>
  )

  const cycleProfilePicture = (direction: 'next' | 'prev') => {
    setUploadedProfileImage(null)
    setProfilePictureIndex((prev) => {
      if (direction === 'next') {
        return prev >= TOTAL_PROFILE_PICTURES ? 1 : prev + 1
      }
      return prev <= 1 ? TOTAL_PROFILE_PICTURES : prev - 1
    })
  }

  const cycleBanner = (direction: 'next' | 'prev') => {
    setUploadedBanner(null)
    setBannerIndex((prev) => {
      if (direction === 'next') {
        return prev >= TOTAL_BANNERS ? 1 : prev + 1
      }
      return prev <= 1 ? TOTAL_BANNERS : prev - 1
    })
  }

  const handleProfileImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setUploadedProfileImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleBannerUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setUploadedBanner(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSkip = () => {
    if (stage !== 'PROFILE' || isSubmitting) return

    const profilePayload: OnboardingProfilePayload = {
      username: username || `user_${Math.random().toString(36).substring(2, 10)}`,
      displayName: displayName || 'New User',
      bio: bio || 'Just joined Babylon!',
      profileImageUrl: resolveAssetUrl(uploadedProfileImage ?? `/assets/user-profiles/profile-${profilePictureIndex}.jpg`),
      coverImageUrl: resolveAssetUrl(uploadedBanner ?? `/assets/user-banners/banner-${bannerIndex}.jpg`),
    }

    void onSubmitProfile(profilePayload)
  }

  const canClose = !isSubmitting // Allow closing at any stage when not submitting
  const canLogout = stage !== 'COMPLETED' && !isSubmitting

  const handleLogout = () => {
    // Use Privy's logout
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/api/auth/logout'
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 z-[100] backdrop-blur-sm"
        onClick={canClose ? onClose : undefined}
      />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#0066FF]/10 rounded-lg">
                <Sparkles className="w-6 h-6 text-[#0066FF]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Welcome to Babylon!</h2>
                <p className="text-sm text-muted-foreground">
                  {stage === 'SOCIAL_IMPORT' 
                    ? 'Connect your account' 
                    : stage === 'PROFILE' 
                    ? 'Set up your profile' 
                    : stage === 'ONCHAIN' 
                    ? 'Complete registration' 
                    : 'Setup complete!'}
                </p>
                {user?.username && stage !== 'PROFILE' && stage !== 'SOCIAL_IMPORT' && (
                  <p className="text-xs text-muted-foreground mt-1">@{user.username}</p>
                )}
              </div>
            </div>
            <button
              onClick={canClose ? onClose : undefined}
              className="p-2 hover:bg-muted rounded-lg disabled:opacity-50"
              disabled={!canClose}
              title={canClose ? 'Close' : 'Complete onboarding to close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {stage === 'SOCIAL_IMPORT' ? (
            <SocialImportStep
              onImport={onSocialImport}
              onSkip={onSkipSocialImport}
              isLoading={isSubmitting}
            />
          ) : stage === 'COMPLETED' ? (
            <div className="p-12 flex flex-col items-center gap-4">
              <Check className="w-10 h-10 text-[#0066FF]" />
              <p className="text-lg font-semibold">Onboarding complete! Enjoy Babylon 🎉</p>
              <button
                type="button"
                className="px-4 py-2 bg-[#0066FF] text-white rounded-lg"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          ) : stage === 'ONCHAIN' ? (
            <div className="p-8 flex flex-col items-center gap-4 text-center">
              {isSubmitting ? (
                <>
                  <BouncingLogo size={32} />
                  <p className="text-lg font-semibold">Finalising on-chain registration...</p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Waiting for blockchain confirmation. This may take 10-30 seconds.
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    You can close this window and return later - your registration will continue in the background.
                  </p>
                </>
              ) : error ? (
                <>
                  <AlertCircle className="w-8 h-8 text-red-500" />
                  <p className="text-lg font-semibold">Registration Error</p>
                  <p className="text-sm text-red-500 max-w-md">{error}</p>
                  <div className="flex flex-col gap-2 mt-4">
                    {!error.toLowerCase().includes('already registered') && (
                      <div className="text-xs text-muted-foreground max-w-md">
                        <p className="font-medium mb-2">Common issues:</p>
                        <ul className="text-left list-disc list-inside space-y-1">
                          <li>Transaction rejected in wallet</li>
                          <li>Insufficient gas on Base Sepolia</li>
                          <li>Network connectivity issues</li>
                        </ul>
                      </div>
                    )}
                    {error.toLowerCase().includes('already registered') && (
                      <div className="text-xs text-muted-foreground max-w-md text-left">
                        <p className="mb-2">
                          Your wallet is already registered on the blockchain. This can happen if you previously completed registration or if another account is using this wallet.
                        </p>
                        <p>
                          You can skip this step and continue using the platform with your off-chain profile.
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        className="px-4 py-2 bg-[#0066FF] text-white rounded-lg disabled:opacity-50"
                        onClick={onRetryOnchain}
                        disabled={isSubmitting}
                      >
                        Retry Registration
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 bg-muted text-foreground rounded-lg"
                        onClick={onSkipOnchain}
                      >
                        Skip for Now
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Sparkles className="w-8 h-8 text-[#0066FF]" />
                  <p className="text-lg font-semibold">Complete On-Chain Registration</p>
                  <div className="text-sm text-muted-foreground max-w-md space-y-2">
                    <p>
                      Register your identity on Base Sepolia blockchain to unlock full features:
                    </p>
                    <ul className="text-left list-disc list-inside space-y-1">
                      <li>On-chain reputation tracking</li>
                      <li>Verifiable trading history</li>
                      <li>NFT-based identity</li>
                    </ul>
                  </div>
                  {user?.walletAddress && (
                    <p className="text-xs text-muted-foreground/70">
                      Wallet: {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                    </p>
                  )}
                  <div className="flex flex-col gap-2 mt-4 w-full max-w-xs">
                    <button
                      type="button"
                      className="w-full px-4 py-2 bg-[#0066FF] text-white rounded-lg disabled:opacity-50 hover:bg-[#0066FF]/90"
                      onClick={onRetryOnchain}
                      disabled={isSubmitting}
                    >
                      Register On-Chain
                    </button>
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:underline"
                      onClick={onSkipOnchain}
                    >
                      Skip & Continue Exploring
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : isLoadingDefaults ? (
            <div className="p-12 flex flex-col items-center gap-4">
              <BouncingLogo size={32} />
              <p className="text-muted-foreground">Generating your profile...</p>
            </div>
          ) : (
            renderProfileForm()
          )}
          
          {/* Footer with logout option */}
          {canLogout && (
            <div className="border-t border-border p-4 flex justify-center gap-4 text-xs text-muted-foreground">
              <button
                onClick={handleLogout}
                className="hover:text-foreground hover:underline"
                disabled={isSubmitting}
              >
                Logout & Switch Account
              </button>
              {stage === 'ONCHAIN' && (
                <button
                  onClick={onSkipOnchain}
                  className="hover:text-foreground hover:underline"
                  disabled={isSubmitting}
                >
                  Skip On-Chain Registration
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
