'use client'

import { useState } from 'react'
import { Download, Trash2, Shield, AlertCircle, ExternalLink } from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'

export function PrivacyTab() {
  const { user } = useAuth()
  const [isExporting, setIsExporting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const response = await apiFetch('/api/users/export-data')
      
      if (!response.ok) {
        throw new Error('Failed to export data')
      }

      // Get the JSON data and create a download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `babylon-data-export-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Data exported successfully')
      logger.info('User exported their data', undefined, 'PrivacyTab')
    } catch (error) {
      logger.error('Failed to export user data', { error }, 'PrivacyTab')
      toast.error('Failed to export data. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
      toast.error('Please type the confirmation text exactly')
      return
    }

    setIsDeleting(true)
    try {
      const response = await apiFetch('/api/users/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation: 'DELETE MY ACCOUNT',
          reason: deleteReason || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete account')
      }
      
      toast.success('Account deleted successfully')
      logger.info('User deleted their account', undefined, 'PrivacyTab')

      // Redirect to logout after a brief delay
      setTimeout(() => {
        window.location.href = '/api/auth/logout'
      }, 2000)
    } catch (error) {
      logger.error('Failed to delete account', { error }, 'PrivacyTab')
      toast.error('Failed to delete account. Please try again or contact support.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-[#0066FF]" />
          Privacy & Data
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage your privacy settings and exercise your data rights under GDPR and CCPA.
        </p>
      </div>

      {/* Legal Documents */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Legal Documents</h3>
        <div className="space-y-2">
          <a
            href="https://docs.babylon.market/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[#0066FF] hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Privacy Policy
          </a>
          <a
            href="https://docs.babylon.market/legal/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[#0066FF] hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Terms of Service
          </a>
        </div>
        {user?.tosAcceptedAt && (
          <p className="text-xs text-muted-foreground">
            You accepted the Terms of Service on {new Date(user.tosAcceptedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Data Export (GDPR Right to Access) */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Download className="w-5 h-5 text-[#0066FF] mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold">Download Your Data</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Export all your personal data, including profile information, posts, comments, trading history, and more.
              This is your right under GDPR Article 15 (Right to Access) and CCPA.
            </p>
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="mt-3 px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0066FF]/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? 'Exporting...' : 'Export My Data'}
            </button>
            <p className="text-xs text-muted-foreground mt-2">
              You will receive a JSON file containing all your data.
            </p>
          </div>
        </div>
      </div>

      {/* Blockchain Data Notice */}
      {user?.onChainRegistered && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-4 space-y-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-500">Blockchain Data Notice</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You have on-chain identity data (wallet address: {user.walletAddress?.slice(0, 6)}...
                {user.walletAddress?.slice(-4)}, NFT token ID: {user.nftTokenId}) that is permanently recorded on the
                blockchain and <strong>cannot be deleted</strong>. This data will remain publicly visible even if you
                delete your account.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Account Deletion (GDPR Right to Erasure) */}
      <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Trash2 className="w-5 h-5 text-red-500 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-500">Delete Your Account</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Permanently delete your account and personal data. This action cannot be undone. This is your right under
              GDPR Article 17 (Right to Erasure) and CCPA.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="mt-3 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete My Account
              </button>
            ) : (
              <div className="mt-4 space-y-3 border border-border rounded-lg p-4 bg-background">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Reason for deletion (optional):
                  </label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Help us improve by telling us why you're leaving..."
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Type <code className="px-2 py-1 bg-muted rounded">DELETE MY ACCOUNT</code> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE MY ACCOUNT"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1 text-sm">
                  <p className="font-semibold text-red-500">⚠️ Warning: This action is irreversible</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Your account and personal data will be permanently deleted</li>
                    <li>All your posts, comments, and content will be removed</li>
                    <li>Your trading history and positions will be deleted</li>
                    <li>Some anonymized data may be retained for analytics</li>
                    {user?.onChainRegistered && (
                      <li className="text-yellow-500 font-medium">
                        Blockchain data (wallet address, NFT) will remain public and cannot be deleted
                      </li>
                    )}
                  </ul>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirmation !== 'DELETE MY ACCOUNT'}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false)
                      setDeleteConfirmation('')
                      setDeleteReason('')
                    }}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="border border-border rounded-lg p-4 space-y-2">
        <h3 className="font-semibold">Privacy Questions?</h3>
        <p className="text-sm text-muted-foreground">
          For privacy-related inquiries, data subject requests, or to exercise your rights, contact us at:
        </p>
        <a href="mailto:privacy@elizas.com" className="text-sm text-[#0066FF] hover:underline">
          privacy@elizas.com
        </a>
        <p className="text-xs text-muted-foreground mt-2">
          We will respond to verified requests within 30 days (45 days for complex requests) as required by GDPR and CCPA.
        </p>
      </div>
    </div>
  )
}

