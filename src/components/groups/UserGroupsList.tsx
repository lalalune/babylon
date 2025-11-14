'use client';

/**
 * User Groups List Component
 * 
 * Displays list of groups the user is a member of
 */

import { useEffect, useState } from 'react';
import { Users, Plus, Crown } from 'lucide-react';
import { CreateGroupModal } from './CreateGroupModal';
import { GroupDetailsModal } from './GroupDetailsModal';
// import { toast } from 'sonner';

interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  createdAt: string;
  memberCount: number;
  isAdmin: boolean;
}

export function UserGroupsList() {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const loadGroups = async () => {
    const response = await fetch('/api/user-groups');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load groups');
    }

    setGroups(data.data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadGroups();
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 bg-background border border-border rounded-xl shadow-sm">
        <div className="text-center text-muted-foreground">Loading groups...</div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-background border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-lg font-bold">My Groups</h3>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4 inline mr-1" />
            Create Group
          </button>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading groups...</div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>You haven't joined any groups yet.</p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-2 text-primary hover:underline text-sm"
              >
                Create your first group
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className="w-full flex items-center justify-between p-4 bg-sidebar border border-border rounded-lg hover:bg-sidebar/80 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{group.name}</h3>
                      {group.isAdmin && (
                        <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                      )}
                    </div>
                    {group.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {group.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground ml-4">
                    <Users className="h-4 w-4" />
                    <span>{group.memberCount}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onGroupCreated={() => {
          loadGroups()
        }}
      />

      {selectedGroupId && (
        <GroupDetailsModal
          groupId={selectedGroupId}
          onClose={() => setSelectedGroupId(null)}
          onGroupUpdated={loadGroups}
        />
      )}
    </>
  );
}

