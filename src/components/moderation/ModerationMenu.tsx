/**
 * Moderation Menu Component
 * 
 * Dropdown menu for blocking, muting, and reporting users
 */

'use client';

import { useState } from 'react';
import { MoreHorizontal, Ban, VolumeX, Flag } from 'lucide-react';
import { BlockUserModal } from './BlockUserModal';
import { MuteUserModal } from './MuteUserModal';
import { ReportModal } from './ReportModal';

interface ModerationMenuProps {
  targetUserId: string;
  targetUsername?: string;
  targetDisplayName?: string;
  targetProfileImageUrl?: string;
  postId?: string; // Optional: if reporting a specific post
  onActionComplete?: () => void;
}

export function ModerationMenu({
  targetUserId,
  targetUsername,
  targetDisplayName,
  targetProfileImageUrl,
  postId,
  onActionComplete,
}: ModerationMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const displayName = targetDisplayName || targetUsername || 'User';

  const handleAction = () => {
    setShowMenu(false);
    onActionComplete?.();
  };

  return (
    <div className="relative">
      {/* Menu Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 hover:bg-muted rounded-lg transition-colors"
        aria-label="More options"
      >
        <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          {/* Overlay to close menu */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50">
            <div className="py-1">
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowMuteModal(true);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-3"
              >
                <VolumeX className="w-4 h-4 text-muted-foreground" />
                <span>Mute {displayName}</span>
              </button>

              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowBlockModal(true);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-3 text-orange-600"
              >
                <Ban className="w-4 h-4" />
                <span>Block {displayName}</span>
              </button>

              <div className="border-t border-border my-1" />

              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowReportModal(true);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-3 text-red-600"
              >
                <Flag className="w-4 h-4" />
                <span>Report {postId ? 'post' : 'user'}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <BlockUserModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        targetUserId={targetUserId}
        targetDisplayName={displayName}
        onSuccess={handleAction}
      />

      <MuteUserModal
        isOpen={showMuteModal}
        onClose={() => setShowMuteModal(false)}
        targetUserId={targetUserId}
        targetDisplayName={displayName}
        onSuccess={handleAction}
      />

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetUserId={targetUserId}
        targetUsername={targetUsername}
        targetDisplayName={displayName}
        targetProfileImageUrl={targetProfileImageUrl}
        postId={postId}
        onSuccess={handleAction}
      />
    </div>
  );
}


