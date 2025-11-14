'use client'

import { useState, useEffect } from 'react'
import { Avatar } from '@/components/shared/Avatar'
import { 
  Settings, 
  Users, 
  UserMinus, 
  Shield, 
  Trash2, 
  Loader2, 
  Edit2,
  LogOut,
  Crown,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrivy } from '@privy-io/react-auth'
import { Button } from '@/components/ui/button'

interface GroupMember {
  userId: string
  username: string | null
  displayName: string | null
  profileImageUrl: string | null
  joinedAt: string
  addedBy: string
  isAdmin: boolean
}

interface GroupDetails {
  id: string
  name: string
  description: string | null
  createdById: string
  createdAt: string
  members: GroupMember[]
  isCurrentUserAdmin: boolean
}

interface GroupSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  groupId: string
  onGroupUpdated?: () => void
  onGroupDeleted?: () => void
  currentUserId: string
}

type Tab = 'general' | 'members'

export function GroupSettingsModal({
  isOpen,
  onClose,
  groupId,
  onGroupUpdated,
  onGroupDeleted,
  currentUserId,
}: GroupSettingsModalProps) {
  const { getAccessToken } = usePrivy()
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [group, setGroup] = useState<GroupDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // General settings state
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [isSaving, setSaving] = useState(false)
  
  // Delete state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Leave state
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  // Member management state
  const [managingMemberId, setManagingMemberId] = useState<string | null>(null)

  // Load group details
  useEffect(() => {
    if (isOpen && groupId) {
      loadGroupDetails()
    }
  }, [isOpen, groupId])

  const loadGroupDetails = async () => {
    setLoading(true)
    setError(null)

    const token = await getAccessToken()
    if (!token) throw new Error('Authentication required')

    const response = await fetch(`/api/user-groups/${groupId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      setLoading(false)
      throw new Error('Failed to load group details')
    }

    const data = await response.json()
    setGroup(data.data)
    setEditedName(data.data.name)
    setEditedDescription(data.data.description || '')
    setLoading(false)
  }

  const handleSaveDetails = async () => {
    if (!group) return
    
    setSaving(true)
    setError(null)

    const token = await getAccessToken()
    if (!token) {
      setSaving(false)
      throw new Error('Authentication required')
    }

    const response = await fetch(`/api/user-groups/${groupId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: editedName,
        description: editedDescription || null,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      setSaving(false)
      throw new Error(errorData.error || 'Failed to update group')
    }

    // Reload group details
    await loadGroupDetails()
    setIsEditing(false)
    onGroupUpdated?.()
    setSaving(false)
  }

  const handleDeleteGroup = async () => {
    setIsDeleting(true)
    setError(null)

    const token = await getAccessToken()
    if (!token) {
      setIsDeleting(false)
      setIsDeleteConfirmOpen(false)
      throw new Error('Authentication required')
    }

    const response = await fetch(`/api/user-groups/${groupId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      setIsDeleting(false)
      setIsDeleteConfirmOpen(false)
      throw new Error(errorData.error || 'Failed to delete group')
    }

    onGroupDeleted?.()
    onClose()
  }

  const handleLeaveGroup = async () => {
    setIsLeaving(true)
    setError(null)

    const token = await getAccessToken()
    if (!token) {
      setIsLeaving(false)
      setIsLeaveConfirmOpen(false)
      throw new Error('Authentication required')
    }

    const response = await fetch(`/api/user-groups/${groupId}/members/${currentUserId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      setIsLeaving(false)
      setIsLeaveConfirmOpen(false)
      throw new Error(errorData.error || 'Failed to leave group')
    }

    onGroupDeleted?.() // Treat as deleted from user's perspective
    onClose()
  }

  const handleRemoveMember = async (memberId: string) => {
    setManagingMemberId(memberId)
    setError(null)

    const token = await getAccessToken()
    if (!token) {
      setManagingMemberId(null)
      throw new Error('Authentication required')
    }

    const response = await fetch(`/api/user-groups/${groupId}/members/${memberId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      setManagingMemberId(null)
      throw new Error(errorData.error || 'Failed to remove member')
    }

    await loadGroupDetails()
    onGroupUpdated?.()
    setManagingMemberId(null)
  }

  const handlePromoteToAdmin = async (memberId: string) => {
    setManagingMemberId(memberId)
    setError(null)

    const token = await getAccessToken()
    if (!token) {
      setManagingMemberId(null)
      throw new Error('Authentication required')
    }

    const response = await fetch(`/api/user-groups/${groupId}/admins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: memberId }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      setManagingMemberId(null)
      throw new Error(errorData.error || 'Failed to promote member')
    }

    await loadGroupDetails()
    onGroupUpdated?.()
    setManagingMemberId(null)
  }

  const handleDemoteFromAdmin = async (memberId: string) => {
    setManagingMemberId(memberId)
    setError(null)

    const token = await getAccessToken()
    if (!token) {
      setManagingMemberId(null)
      throw new Error('Authentication required')
    }

    const response = await fetch(`/api/user-groups/${groupId}/admins/${memberId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      setManagingMemberId(null)
      throw new Error(errorData.error || 'Failed to demote admin')
    }

    await loadGroupDetails()
    onGroupUpdated?.()
    setManagingMemberId(null)
  }

  const isCreator = group?.createdById === currentUserId
  const isAdmin = group?.isCurrentUserAdmin

  if (!isOpen) return null

  const handleClose = () => {
    if (isSaving || isDeleting || isLeaving) return
    onClose()
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleClose()
          }
        }}
      >
        <div
          className="bg-background border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Group Settings</h2>
            </div>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              disabled={isSaving || isDeleting || isLeaving}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 px-6 pt-4">
            <button
              onClick={() => setActiveTab('general')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'general'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-sidebar border border-border hover:bg-accent'
              )}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                activeTab === 'members'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-sidebar border border-border hover:bg-accent'
              )}
            >
              <Users className="w-4 h-4" />
              Members {group && `(${group.members.length})`}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !group ? (
              <div className="text-center py-8 text-muted-foreground">Group not found</div>
            ) : (
            <>
              {/* General Tab */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Group Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/50 outline-none"
                        disabled={!isAdmin}
                      />
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-sidebar-accent/30 rounded-lg">
                        <span className="font-medium">{group.name}</span>
                        {isAdmin && (
                          <button
                            onClick={() => setIsEditing(true)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    {isEditing ? (
                      <textarea
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/50 outline-none resize-none"
                        disabled={!isAdmin}
                        placeholder="Add a description..."
                      />
                    ) : (
                      <div className="p-3 bg-sidebar-accent/30 rounded-lg min-h-[80px]">
                        <p className="text-sm text-muted-foreground">
                          {group.description || 'No description'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Save/Cancel buttons */}
                  {isEditing && isAdmin && (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveDetails}
                        disabled={isSaving || !editedName.trim()}
                        className="flex-1"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false)
                          setEditedName(group.name)
                          setEditedDescription(group.description || '')
                        }}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* Danger Zone */}
                  <div className="mt-8 pt-6 border-t border-border">
                    <h3 className="text-sm font-semibold mb-3 text-red-500">Danger Zone</h3>
                    <div className="space-y-2">
                      {isCreator ? (
                        <Button
                          variant="outline"
                          onClick={() => setIsDeleteConfirmOpen(true)}
                          className="w-full justify-start text-red-500 border-red-500/50 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Group
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => setIsLeaveConfirmOpen(true)}
                          className="w-full justify-start text-yellow-500 border-yellow-500/50 hover:bg-yellow-500/10"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Leave Group
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Members Tab */}
              {activeTab === 'members' && (
                <div className="space-y-3">
                  {group.members.map((member) => {
                    const isCurrentUser = member.userId === currentUserId
                    const isMemberCreator = member.userId === group.createdById
                    const isManaging = managingMemberId === member.userId

                    return (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between p-3 bg-sidebar border border-border rounded-lg hover:bg-sidebar/80 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            id={member.userId}
                            name={member.displayName || member.username || 'User'}
                            type="user"
                            size="md"
                            imageUrl={member.profileImageUrl || undefined}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {member.displayName || member.username || 'User'}
                              </span>
                              {isCurrentUser && (
                                <span className="text-xs text-muted-foreground">(You)</span>
                              )}
                              {isMemberCreator && (
                                <Crown className="w-3.5 h-3.5 text-yellow-500" />
                              )}
                              {member.isAdmin && (
                                <Shield className="w-3.5 h-3.5 text-primary" />
                              )}
                            </div>
                            {member.username && member.displayName && (
                              <span className="text-xs text-muted-foreground">@{member.username}</span>
                            )}
                          </div>
                        </div>

                        {/* Member Actions */}
                        {isAdmin && !isCurrentUser && !isMemberCreator && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => member.isAdmin ? handleDemoteFromAdmin(member.userId) : handlePromoteToAdmin(member.userId)}
                              disabled={isManaging}
                              className="p-2 hover:bg-background rounded-md transition-colors disabled:opacity-50"
                              title={member.isAdmin ? 'Remove admin' : 'Make admin'}
                            >
                              {isManaging ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Shield className={cn(
                                  "w-4 h-4",
                                  member.isAdmin ? 'text-primary' : 'text-muted-foreground'
                                )} />
                              )}
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.userId)}
                              disabled={isManaging}
                              className="p-2 hover:bg-background rounded-md transition-colors disabled:opacity-50"
                              title="Remove member"
                            >
                              {isManaging ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <UserMinus className="w-4 h-4 text-red-500" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {isDeleteConfirmOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setIsDeleteConfirmOpen(false)
            }
          }}
        >
          <div
            className="bg-background border border-border rounded-xl w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">Delete Group?</h3>
              <p className="text-sm text-muted-foreground">
                This will permanently delete the group and remove all members. This action cannot be undone.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-sidebar border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteGroup}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-red-500 text-primary-foreground hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 inline animate-spin" />
                  ) : (
                    'Delete Group'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leave Confirmation Dialog */}
      {isLeaveConfirmOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLeaving) {
              setIsLeaveConfirmOpen(false)
            }
          }}
        >
          <div
            className="bg-background border border-border rounded-xl w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold">Leave Group?</h3>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to leave this group? You'll need to be re-invited to join again.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsLeaveConfirmOpen(false)}
                  disabled={isLeaving}
                  className="flex-1 px-4 py-2.5 bg-sidebar border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeaveGroup}
                  disabled={isLeaving}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isLeaving ? (
                    <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                  ) : (
                    'Leave Group'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

