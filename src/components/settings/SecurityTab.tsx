'use client'

import { usePrivy, useWallets } from '@privy-io/react-auth'
import { Shield, Wallet, Key, LogOut, ExternalLink, AlertCircle, CheckCircle2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { useAuth } from '@/hooks/useAuth'

export function SecurityTab() {
  const { user: privyUser, linkWallet, unlinkWallet, exportWallet } = usePrivy()
  const { wallets } = useWallets()
  const { user, logout } = useAuth()
  
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard`)
    } catch (error) {
      logger.error('Failed to copy to clipboard', { error }, 'SecurityTab')
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Logged out successfully')
      logger.info('User logged out from security settings', undefined, 'SecurityTab')
    } catch (error) {
      logger.error('Failed to logout', { error }, 'SecurityTab')
      toast.error('Failed to logout')
    }
  }

  const getWalletTypeDisplay = (walletClientType: string) => {
    switch (walletClientType) {
      case 'privy':
      case 'privy-v2':
        return 'Embedded Wallet'
      case 'metamask':
        return 'MetaMask'
      case 'coinbase_wallet':
        return 'Coinbase Wallet'
      case 'rainbow':
        return 'Rainbow'
      case 'rabby_wallet':
        return 'Rabby'
      default:
        return 'External Wallet'
    }
  }

  const isEmbeddedWallet = (walletClientType: string) => {
    return walletClientType === 'privy' || walletClientType === 'privy-v2'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-[#0066FF]" />
          Security Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage your account security, connected wallets, and authentication methods.
        </p>
      </div>

      {/* Authentication Info */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold">Account Security</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your account is secured with <strong>Privy authentication</strong>, providing secure
              wallet-based and social login options.
            </p>
            {privyUser && (
              <div className="mt-3 space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">User ID: </span>
                  <code className="px-2 py-1 bg-muted rounded text-xs">
                    {privyUser.id}
                  </code>
                </div>
                {privyUser.email && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Email: </span>
                    <span className="font-medium">{privyUser.email.address}</span>
                  </div>
                )}
                {privyUser.farcaster && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Farcaster: </span>
                    <span className="font-medium">@{privyUser.farcaster.username}</span>
                  </div>
                )}
                {privyUser.twitter && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Twitter: </span>
                    <span className="font-medium">@{privyUser.twitter.username}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connected Wallets */}
      <div className="border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Connected Wallets
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your blockchain wallets and authentication methods
            </p>
          </div>
          {linkWallet && (
            <button
              onClick={linkWallet}
              className="px-4 py-2 bg-[#0066FF] text-primary-foreground rounded-lg hover:bg-[#0066FF]/90 text-sm font-medium"
            >
              Link Wallet
            </button>
          )}
        </div>

        {wallets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No wallets connected</p>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {wallets.map((wallet) => (
              <div
                key={wallet.address}
                className="flex items-center justify-between p-3 bg-muted rounded-lg gap-4 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {getWalletTypeDisplay(wallet.walletClientType)}
                    </span>
                    {isEmbeddedWallet(wallet.walletClientType) && (
                      <span className="px-2 py-0.5 bg-[#0066FF]/20 text-[#0066FF] text-xs rounded">
                        Embedded
                      </span>
                    )}
                    {wallet.address === user?.walletAddress && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-xs rounded">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs text-muted-foreground">
                      {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(wallet.address, 'Address')}
                      className="p-1 hover:bg-background rounded"
                      title="Copy full address"
                    >
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isEmbeddedWallet(wallet.walletClientType) && exportWallet && (
                    <button
                      onClick={exportWallet}
                      className="px-3 py-1.5 bg-background border border-border rounded text-xs font-medium hover:bg-accent flex items-center gap-1"
                      title="Export wallet private key"
                    >
                      <Key className="w-3 h-3" />
                      <span className="hidden sm:inline">Export</span>
                    </button>
                  )}
                  {wallets.length > 1 && unlinkWallet && (
                    <button
                      onClick={() => unlinkWallet(wallet.address)}
                      className="px-3 py-1.5 text-red-500 hover:bg-red-500/10 rounded text-xs font-medium"
                    >
                      Unlink
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              <strong className="text-foreground">Embedded wallets</strong> are created and managed by Privy,
              enabling gasless transactions. You can export your private key at any time.{' '}
              <strong className="text-foreground">External wallets</strong> require you to pay gas fees.
            </div>
          </div>
        </div>
      </div>

      {/* Session Management */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <LogOut className="w-5 h-5 text-[#0066FF] mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold">Active Session</h3>
            <p className="text-sm text-muted-foreground mt-1">
              You are currently logged in. Log out to end your session and clear authentication.
            </p>
            <button
              onClick={handleLogout}
              className="mt-3 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 text-sm font-medium"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* Additional Resources */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Security Resources</h3>
        <div className="space-y-2">
          <a
            href="https://docs.privy.io/guide/security"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[#0066FF] hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Privy Security Documentation
          </a>
          <a
            href="https://docs.babylon.market/security"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[#0066FF] hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Babylon Security Best Practices
          </a>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          For security concerns or to report vulnerabilities, contact{' '}
          <a href="mailto:security@elizas.com" className="text-[#0066FF] hover:underline">
            security@elizas.com
          </a>
        </p>
      </div>

      {/* Privacy & Account Deletion Link */}
      <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-4 space-y-2">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-500">Account Privacy & Deletion</h3>
            <p className="text-sm text-muted-foreground mt-1">
              To export your data or permanently delete your account, visit the Privacy tab.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

