'use client';

import { useEffect, useState } from 'react';

import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';

import { ArrowLeft, Bell, Palette, Save, Shield, User } from 'lucide-react';

import { LoginButton } from '@/components/auth/LoginButton';
import { BouncingLogo } from '@/components/shared/BouncingLogo';
import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';
import { PrivacyTab } from '@/components/settings/PrivacyTab';

import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { WALLET_ERROR_MESSAGES } from '@/lib/wallet-utils';

import { useAuth } from '@/hooks/useAuth';
import { useUpdateAgentProfileTx } from '@/hooks/useUpdateAgentProfileTx';

import { useAuthStore } from '@/stores/authStore';
import { useSearchParams } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    ready,
    authenticated,
    smartWalletAddress,
    smartWalletReady,
    refresh,
  } = useAuth();
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState(() => {
    // Check for tab parameter in URL
    const tab = searchParams?.get('tab');
    return tab || 'profile';
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Profile settings state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');

  // Notification settings state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [postNotifications, setPostNotifications] = useState(true);
  const [marketNotifications, setMarketNotifications] = useState(true);
  const { updateAgentProfile } = useUpdateAgentProfileTx();

  // Theme settings - connected to next-themes
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Wait for hydration to avoid SSR mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate time remaining until username can be changed again
  const getUsernameChangeTimeRemaining = (): {
    canChange: boolean;
    hours: number;
    minutes: number;
  } | null => {
    if (!user?.usernameChangedAt)
      return { canChange: true, hours: 0, minutes: 0 };

    const lastChangeTime = new Date(user.usernameChangedAt).getTime();
    const now = Date.now();
    const hoursSinceChange = (now - lastChangeTime) / (1000 * 60 * 60);
    const hoursRemaining = 24 - hoursSinceChange;

    if (hoursRemaining <= 0) {
      return { canChange: true, hours: 0, minutes: 0 };
    }

    return {
      canChange: false,
      hours: Math.floor(hoursRemaining),
      minutes: Math.floor((hoursRemaining - Math.floor(hoursRemaining)) * 60),
    };
  };

  const usernameChangeLimit = getUsernameChangeTimeRemaining();

  // Sync profile fields when user data changes
  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
    setUsername(user?.username ?? '');
    setBio(user?.bio ?? '');
  }, [user?.displayName, user?.username, user?.bio]);

  const handleSave = async () => {
    if (!user?.id) return;
    if (user.onChainRegistered !== true) {
      setErrorMessage(
        'Complete your on-chain registration before editing your profile.'
      );
      return;
    }

    setSaving(true);
    setSaved(false);
    setErrorMessage(null);

    try {
      if (!smartWalletReady || !smartWalletAddress) {
        throw new Error(WALLET_ERROR_MESSAGES.NO_EMBEDDED_WALLET);
      }

      const trimmedDisplayName = (displayName ?? '').trim();
      const trimmedUsername = (username ?? '').trim();
      const trimmedBio = (bio ?? '').trim();

      const endpoint = `https://babylon.game/agent/${smartWalletAddress.toLowerCase()}`;
      const metadata = {
        name:
          trimmedDisplayName ||
          trimmedUsername ||
          user.displayName ||
          user.username ||
          'Babylon User',
        username: trimmedUsername || null,
        bio: trimmedBio || null,
        profileImageUrl: user.profileImageUrl ?? null,
        coverImageUrl: user.coverImageUrl ?? null,
      };

      const txHash = await updateAgentProfile({
        endpoint,
        metadata,
      });

      const token =
        typeof window !== 'undefined' ? window.__privyAccessToken : null;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `/api/users/${encodeURIComponent(user.id)}/update-profile`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            displayName: trimmedDisplayName,
            username: trimmedUsername,
            bio: trimmedBio,
            onchainTxHash: txHash,
          }),
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.error || 'Unable to save your changes.';
        throw new Error(message);
      }

      if (payload.user) {
        setUser({
          ...user,
          username: payload.user.username,
          displayName: payload.user.displayName,
          bio: payload.user.bio,
          usernameChangedAt: payload.user.usernameChangedAt,
          referralCode: payload.user.referralCode,
          onChainRegistered:
            payload.user.onChainRegistered ?? user.onChainRegistered,
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await refresh().catch(() => undefined);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'An error occurred while updating the profile.';
      setErrorMessage(message);
      logger.error(
        'Failed to save profile settings',
        { error },
        'SettingsPage'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <PageContainer>
        <div className="w-full max-w-2xl mx-auto space-y-6 px-4 sm:px-0">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32 max-w-full" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-card/50 backdrop-blur rounded-lg p-4 sm:p-6 border border-border space-y-4"
            >
              <Skeleton className="h-6 w-40 max-w-full mb-4" />
              {Array.from({ length: 2 }).map((_, j) => (
                <div
                  key={j}
                  className="flex items-center justify-between gap-3 py-3 border-b border-border/5 last:border-0"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <Skeleton className="h-4 w-32 max-w-full" />
                    <Skeleton className="h-3 w-48 max-w-full" />
                  </div>
                  <Skeleton className="h-8 w-16 flex-shrink-0 rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </PageContainer>
    );
  }

  if (!authenticated) {
    return (
      <PageContainer>
        <div className="max-w-2xl mx-auto text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Settings</h1>
          <p className="text-muted-foreground mb-8">
            Please sign in to access your settings.
          </p>
          <LoginButton />
        </div>
      </PageContainer>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'theme', label: 'Theme', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'privacy', label: 'Privacy', icon: Shield },
  ];

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-8 border-b border-border">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 border-b-2 transition-all',
                  activeTab === tab.id
                    ? 'border-[#0066FF] text-[#0066FF]'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium mb-2"
                >
                  Display Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                  placeholder="Enter your display name"
                />
              </div>

              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium mb-2"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={Boolean(
                    usernameChangeLimit && !usernameChangeLimit.canChange
                  )}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF] disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter your username"
                />
                {usernameChangeLimit && !usernameChangeLimit.canChange ? (
                  <p className="text-xs text-yellow-500 mt-1">
                    Username can only be changed once every 24 hours. Please
                    wait {usernameChangeLimit.hours}h{' '}
                    {usernameChangeLimit.minutes}m before changing again.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Username can be changed once every 24 hours. Changing your
                    username will update your referral code.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium mb-2">
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066FF] resize-none"
                  placeholder="Tell us about yourself..."
                />
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Email Notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0066FF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0066FF]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Push Notifications</h3>
                  <p className="text-sm text-muted-foreground">
                    Receive push notifications in your browser
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pushNotifications}
                    onChange={(e) => setPushNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0066FF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0066FF]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">New Posts</h3>
                  <p className="text-sm text-muted-foreground">
                    Get notified when people you follow post
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={postNotifications}
                    onChange={(e) => setPostNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0066FF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0066FF]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Market Updates</h3>
                  <p className="text-sm text-muted-foreground">
                    Get notified about market changes
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketNotifications}
                    onChange={(e) => setMarketNotifications(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0066FF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0066FF]"></div>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'theme' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-4">Theme Preference</h3>
                {!mounted ? (
                  <div className="flex items-center justify-center py-8">
                    <BouncingLogo size={24} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {['light', 'dark', 'system'].map((themeOption) => (
                      <label
                        key={themeOption}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted transition-colors"
                      >
                        <input
                          type="radio"
                          name="theme"
                          value={themeOption}
                          checked={theme === themeOption}
                          onChange={() => setTheme(themeOption)}
                          className="w-4 h-4 text-[#0066FF]"
                        />
                        <div>
                          <p className="font-medium capitalize">
                            {themeOption}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {themeOption === 'light' &&
                              'Light background with dark text'}
                            {themeOption === 'dark' &&
                              'Dark background with light text'}
                            {themeOption === 'system' &&
                              'Match your system settings'}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium mb-2">Account Security</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your account is secured with Privy authentication.
                </p>
                <button className="text-[#0066FF] hover:text-[#2952d9] text-sm font-medium">
                  View Security Details →
                </button>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium mb-2">Connected Wallets</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage your connected blockchain wallets.
                </p>
                <button className="text-[#0066FF] hover:text-[#2952d9] text-sm font-medium">
                  Manage Wallets →
                </button>
              </div>

              <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-lg">
                <h3 className="font-medium text-red-500 mb-2">Danger Zone</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Delete your account and all associated data. This action
                  cannot be undone.
                </p>
                <button className="text-red-500 hover:text-red-600 text-sm font-medium">
                  Delete Account →
                </button>
              </div>
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && <PrivacyTab />}

          {/* Save Button - Only show for profile tab (theme saves automatically) */}
          {activeTab === 'profile' && (
            <div className="pt-6 border-t border-border">
              {errorMessage && (
                <p className="mb-4 text-sm text-red-500">{errorMessage}</p>
              )}
              {user?.onChainRegistered !== true && !errorMessage && (
                <p className="mb-4 text-sm text-yellow-500">
                  Complete your on-chain registration before editing your
                  profile.
                </p>
              )}
              <button
                onClick={handleSave}
                disabled={saving || user?.onChainRegistered !== true}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all',
                  'bg-[#0066FF] text-white hover:bg-[#2952d9]',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <Save className="w-4 h-4" />
                <span>
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                </span>
              </button>
            </div>
          )}

          {/* Theme saves automatically, show confirmation */}
          {activeTab === 'theme' && mounted && (
            <div className="pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Theme preference is saved automatically and applied immediately.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
