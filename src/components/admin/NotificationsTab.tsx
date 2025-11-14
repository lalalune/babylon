'use client'

import { useState, useCallback, useEffect, useTransition } from 'react'
import { Bell, Send, Users, User, MessageCircle, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type NotificationType = 'system' | 'comment' | 'reaction' | 'follow' | 'mention' | 'reply' | 'share';

type RecipientType = 'specific' | 'all';

export function NotificationsTab() {
  const [message, setMessage] = useState('')
  const [userId, setUserId] = useState('')
  const [type, setType] = useState<NotificationType>('system')
  const [recipientType, setRecipientType] = useState<RecipientType>('specific')
  const [isSending, startSending] = useTransition();

  // DM Testing state
  const [dmSenderId, setDmSenderId] = useState('demo-user-babylon-support')
  const [dmRecipientId, setDmRecipientId] = useState('')
  const [isSendingDm, startSendingDm] = useTransition();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null)

  // Fetch current user ID on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      if (!token) return

      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setCurrentUserId(data.user?.id || null)
      }
    }
    
    fetchCurrentUser()
  }, [])

  const handleSend = useCallback(async () => {
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }

    if (recipientType === 'specific' && !userId.trim()) {
      toast.error('Please enter a user ID')
      return
    }

    startSending(async () => {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          type,
          ...(recipientType === 'specific' ? { userId: userId.trim() } : { sendToAll: true }),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(data.message || 'Notification sent successfully');
        // Reset form
        setMessage('');
        setUserId('');
      } else {
        toast.error(data.message || 'Failed to send notification');
      }
    });
  }, [message, userId, type, recipientType, startSending])

  const handleDebugDMs = useCallback(async () => {
    if (!dmRecipientId.trim()) {
      toast.error('Please enter a recipient user ID to debug')
      return
    }

    startSendingDm(async () => {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/admin/debug-dm?userId=${encodeURIComponent(dmRecipientId.trim())}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      console.log('[Debug DM]', data)
      setDebugInfo(data);
      
      if (data.participantRecords?.length === 0) {
        toast.error(`No DM chats found for user ${dmRecipientId}`)
      } else {
        toast.success(`Found ${data.participantRecords?.length || 0} DM participant records and ${data.chats?.length || 0} chats`)
      }
    });
  }, [dmRecipientId, startSendingDm])

  const handleSendTestDMs = useCallback(async () => {
    if (!dmSenderId.trim()) {
      toast.error('Please enter a sender user ID')
      return
    }

    if (!dmRecipientId.trim()) {
      toast.error('Please enter a recipient user ID')
      return
    }

    if (dmSenderId === dmRecipientId) {
      toast.error('Sender and recipient must be different users')
      return
    }

    startSendingDm(async () => {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null;

      if (!token) {
        throw new Error('Not authenticated');
      }

      toast.info('Sending 100 test DM messages... This may take a moment.');

      const response = await fetch('/api/admin/test-dm-messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderId: dmSenderId.trim(),
          recipientId: dmRecipientId.trim(),
          messageCount: 100,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const chatId = data.chatId;
        console.log('[Admin] Test DM messages sent. Chat ID:', chatId, 'Data:', data);
        toast.success(data.message || 'Test DM messages sent successfully', {
          duration: 10000,
          action: {
            label: 'Go to Chats',
            onClick: () => window.location.href = '/chats'
          }
        });
      } else {
        console.error('[Admin] Failed to send messages:', data);
        toast.error(data.message || 'Failed to send test DM messages');
      }
    });
  }, [dmSenderId, dmRecipientId, startSendingDm])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Send Notifications</h2>
      </div>

      {/* Form */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        {/* Recipient Type */}
        <div>
          <label className="block text-sm font-medium mb-2">Recipient</label>
          <div className="flex gap-2">
            <button
              onClick={() => setRecipientType('specific')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors',
                recipientType === 'specific'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted'
              )}
            >
              <User className="w-4 h-4" />
              <span>Specific User</span>
            </button>
            <button
              onClick={() => setRecipientType('all')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors',
                recipientType === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted'
              )}
            >
              <Users className="w-4 h-4" />
              <span>All Users</span>
            </button>
          </div>
        </div>

        {/* User ID (only for specific user) */}
        {recipientType === 'specific' && (
          <div>
            <label htmlFor="userId" className="block text-sm font-medium mb-2">
              User ID
            </label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID (e.g., cm123abc...)"
              className={cn(
                'w-full px-4 py-2 rounded-lg border border-border',
                'bg-background text-foreground',
                'focus:outline-none focus:border-border',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              disabled={isSending}
            />
            <p className="text-xs text-muted-foreground mt-1">
              You can find user IDs in the Users tab or in the database
            </p>
          </div>
        )}

        {/* Notification Type */}
        <div>
          <label htmlFor="type" className="block text-sm font-medium mb-2">
            Type
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as NotificationType)}
            className={cn(
              'w-full px-4 py-2 rounded-lg border border-border',
              'bg-background text-foreground',
              'focus:outline-none focus:border-border',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            disabled={isSending}
          >
            <option value="system">System</option>
            <option value="comment">Comment</option>
            <option value="reaction">Reaction</option>
            <option value="follow">Follow</option>
            <option value="mention">Mention</option>
            <option value="reply">Reply</option>
            <option value="share">Share</option>
          </select>
        </div>

        {/* Message */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium mb-2">
            Message
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter notification message..."
            rows={4}
            maxLength={500}
            className={cn(
              'w-full px-4 py-2 rounded-lg border border-border',
              'bg-background text-foreground',
              'focus:outline-none focus:border-border',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'resize-none'
            )}
            disabled={isSending}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {message.length}/500 characters
          </p>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isSending || !message.trim() || (recipientType === 'specific' && !userId.trim())}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg',
            'bg-primary text-primary-foreground font-semibold',
            'hover:bg-primary/90 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Send className="w-4 h-4" />
          <span>{isSending ? 'Sending...' : 'Send Notification'}</span>
        </button>
      </div>

      {/* Warning */}
      {recipientType === 'all' && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            ⚠️ <strong>Warning:</strong> This will send the notification to all non-banned users.
            Make sure your message is appropriate for all users.
          </p>
        </div>
      )}

      {/* Info */}
      <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
        <h3 className="font-semibold text-sm">Tips:</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Notifications appear in the user&apos;s notification feed</li>
          <li>System notifications are best for announcements and updates</li>
          <li>Keep messages concise and actionable (max 500 characters)</li>
          <li>Notifications won&apos;t be sent to banned users or NPCs/actors</li>
        </ul>
      </div>

      {/* Divider */}
      <div className="border-t border-border my-8" />

      {/* Group Invite Section */}
      <GroupInviteSection />

      {/* Divider */}
      <div className="border-t border-border my-8" />

      {/* DM Testing Section */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Test DM Messages</h2>
        </div>

        <p className="text-sm text-muted-foreground">
          Send 100 test messages between users to test DM pagination and scrolling behavior.
        </p>

        {/* Form */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          {/* Sender User ID */}
          <div>
            <label htmlFor="dmSenderId" className="block text-sm font-medium mb-2">
              Sender User ID
            </label>
            <input
              id="dmSenderId"
              type="text"
              value={dmSenderId}
              onChange={(e) => setDmSenderId(e.target.value)}
              placeholder="Enter sender user ID"
              className={cn(
                'w-full px-4 py-2 rounded-lg border border-border',
                'bg-background text-foreground',
                'focus:outline-none focus:border-border',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              disabled={isSendingDm}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Default: demo-user-babylon-support (Babylon Support)
            </p>
          </div>

          {/* Recipient User ID */}
          <div>
            <label htmlFor="dmRecipientId" className="block text-sm font-medium mb-2">
              Recipient User ID
            </label>
            <div className="flex gap-2">
              <input
                id="dmRecipientId"
                type="text"
                value={dmRecipientId}
                onChange={(e) => setDmRecipientId(e.target.value)}
                placeholder="Enter recipient user ID or use quick fill"
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg border border-border',
                  'bg-background text-foreground',
                  'focus:outline-none focus:border-border',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                disabled={isSendingDm}
              />
              <button
                type="button"
                onClick={() => {
                  if (currentUserId) {
                    setDmRecipientId(currentUserId)
                    toast.success('Using your user ID as recipient')
                  } else {
                    toast.error('Could not fetch your user ID')
                  }
                }}
                disabled={isSendingDm || !currentUserId}
                className={cn(
                  'px-3 py-2 rounded-lg border border-border',
                  'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
                  'text-xs whitespace-nowrap font-semibold',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                title="Use your logged-in user ID as recipient"
              >
                Use My ID
              </button>
              <button
                type="button"
                onClick={() => setDmRecipientId('demo-user-welcome-bot')}
                disabled={isSendingDm}
                className={cn(
                  'px-3 py-2 rounded-lg border border-border',
                  'bg-background hover:bg-muted transition-colors',
                  'text-xs whitespace-nowrap',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                title="Use Welcome Bot as recipient"
              >
                Welcome Bot
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Click &quot;Use My ID&quot; to use your logged-in account (blockchain_b0ss), or &quot;Welcome Bot&quot; for the test user
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleDebugDMs}
              disabled={!dmRecipientId.trim()}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg',
                'bg-secondary text-secondary-foreground font-medium',
                'hover:bg-secondary/90 transition-colors border border-border',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title="Check what DM chats exist for this user"
            >
              🔍 Debug DMs
            </button>
            
            <button
              onClick={handleSendTestDMs}
              disabled={isSendingDm || !dmSenderId.trim() || !dmRecipientId.trim()}
              className={cn(
                'flex-[2] flex items-center justify-center gap-2 px-6 py-3 rounded-lg',
                'bg-primary text-primary-foreground font-semibold',
                'hover:bg-primary/90 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <MessageCircle className="w-4 h-4" />
              <span>{isSendingDm ? 'Sending 100 Messages...' : 'Send 100 Test DM Messages'}</span>
            </button>
          </div>
        </div>

        {/* Debug Info Display */}
        {debugInfo && (
          <div className="bg-card border border-border rounded-lg p-4 mt-4">
            <h3 className="font-semibold text-sm mb-2">Debug Results:</h3>
            <div className="bg-muted rounded p-3 text-xs font-mono overflow-auto max-h-96">
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            ℹ️ <strong>Note:</strong> This will create or use an existing DM chat between the two users
            and send 100 numbered test messages. Perfect for testing pagination when scrolling up in the chat.
          </p>
        </div>

        {/* Default Users Info */}
        <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-sm">How to Use:</h3>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>
              <strong>Easiest:</strong> Click &quot;Use My ID&quot; button to test with your own account!
            </li>
            <li>
              <strong>Or use Welcome Bot:</strong> Click &quot;Welcome Bot&quot; to use the default test user
            </li>
            <li>
              <strong>Find other IDs:</strong> Go to the &quot;Users&quot; tab above to see all user IDs
            </li>
          </ol>
          
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mt-3">
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              ⚠️ <strong>Important:</strong> You need the <strong>user ID</strong> (long string like &quot;cm3x7y8z9...&quot;), 
              not the username. The &quot;Use My ID&quot; button handles this automatically!
            </p>
          </div>
          
          <div className="border-t border-border pt-3 mt-3">
            <h4 className="font-semibold text-xs mb-2">Default Test Users (auto-seeded):</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded font-mono">demo-user-babylon-support</code>
                <span>→ Babylon Support (default sender)</span>
              </li>
              <li className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded font-mono">demo-user-welcome-bot</code>
                <span>→ Welcome Bot (click button to use)</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// Group Invite Section Component
function GroupInviteSection() {
  const [npcId, setNpcId] = useState('')
  const [userId, setUserId] = useState('')
  const [chatId, setChatId] = useState('')
  const [chatName, setChatName] = useState('')
  const [sending, setSending] = useState(false)

  const handleSendInvite = useCallback(async () => {
    if (!npcId.trim()) {
      toast.error('Please enter an NPC ID')
      return
    }

    if (!userId.trim()) {
      toast.error('Please enter a user ID')
      return
    }

    setSending(true)

    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null

    if (!token) {
      throw new Error('Not authenticated')
    }

    const response = await fetch('/api/admin/group-invite', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        npcId: npcId.trim(),
        userId: userId.trim(),
        chatId: chatId.trim() || undefined,
        chatName: chatName.trim() || undefined,
      }),
    })

    const data = await response.json()

    if (response.ok && data.success) {
      toast.success(data.message || 'Group invite sent successfully')
      // Reset form
      setUserId('')
      setChatId('')
      setChatName('')
    } else {
      toast.error(data.error || data.message || 'Failed to send group invite')
    }
    setSending(false)
  }, [npcId, userId, chatId, chatName])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Send Group Chat Invite</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Send a group chat invite to a user on behalf of an NPC. This will add the user to the NPC&apos;s group chat.
      </p>

      {/* Form */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        {/* NPC ID */}
        <div>
          <label htmlFor="npcId" className="block text-sm font-medium mb-2">
            NPC ID (Inviter) *
          </label>
          <input
            id="npcId"
            type="text"
            value={npcId}
            onChange={(e) => setNpcId(e.target.value)}
            placeholder="Enter NPC/Actor ID (e.g., actor-1, demo-user-...)"
            className={cn(
              'w-full px-4 py-2 rounded-lg border border-border',
              'bg-background text-foreground',
              'focus:outline-none focus:border-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            disabled={sending}
          />
          <p className="text-xs text-muted-foreground mt-1">
            The NPC that will send the invite. Check the Users tab or database for valid NPC IDs.
          </p>
        </div>

        {/* User ID */}
        <div>
          <label htmlFor="inviteUserId" className="block text-sm font-medium mb-2">
            User ID (Invitee) *
          </label>
          <input
            id="inviteUserId"
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter user ID to invite"
            className={cn(
              'w-full px-4 py-2 rounded-lg border border-border',
              'bg-background text-foreground',
              'focus:outline-none focus:border-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            disabled={sending}
          />
          <p className="text-xs text-muted-foreground mt-1">
            The user who will receive the invite. Find user IDs in the Users tab.
          </p>
        </div>

        {/* Chat ID (Optional) */}
        <div>
          <label htmlFor="chatId" className="block text-sm font-medium mb-2">
            Chat ID (Optional)
          </label>
          <input
            id="chatId"
            type="text"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="Leave empty for auto-generated ID"
            className={cn(
              'w-full px-4 py-2 rounded-lg border border-border',
              'bg-background text-foreground',
              'focus:outline-none focus:border-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            disabled={sending}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Optional. If empty, will use format: [npcId]-owned-chat
          </p>
        </div>

        {/* Chat Name (Optional) */}
        <div>
          <label htmlFor="chatName" className="block text-sm font-medium mb-2">
            Chat Name (Optional)
          </label>
          <input
            id="chatName"
            type="text"
            value={chatName}
            onChange={(e) => setChatName(e.target.value)}
            placeholder="Leave empty for auto-generated name"
            className={cn(
              'w-full px-4 py-2 rounded-lg border border-border',
              'bg-background text-foreground',
              'focus:outline-none focus:border-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            disabled={sending}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Optional. If empty, will use format: [NPC Name]&apos;s Inner Circle
          </p>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSendInvite}
          disabled={sending || !npcId.trim() || !userId.trim()}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg',
            'bg-primary text-primary-foreground font-semibold',
            'hover:bg-primary/90 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <UserPlus className="w-4 h-4" />
          <span>{sending ? 'Sending Invite...' : 'Send Group Invite'}</span>
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-2">
        <h3 className="font-semibold text-sm text-blue-600 dark:text-blue-400">How it works:</h3>
        <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li>The NPC will invite the user to their group chat</li>
          <li>A notification will be sent to the user</li>
          <li>The user will be added as a participant in the chat</li>
          <li>If the chat doesn&apos;t exist, it will be created automatically</li>
        </ul>
      </div>
    </div>
  )
}

