/**
 * Report Modal
 * 
 * Modal for reporting users or posts
 */

'use client';

import { useState, useTransition } from 'react';
import { X, Flag, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/shared/Avatar';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUsername?: string;
  targetDisplayName?: string;
  targetProfileImageUrl?: string;
  postId?: string;
  onSuccess?: () => void;
}

const REPORT_CATEGORIES = [
  { value: 'spam', label: 'Spam or scam', description: 'Unwanted commercial content or fraudulent activity' },
  { value: 'harassment', label: 'Harassment or bullying', description: 'Targeting someone with abuse' },
  { value: 'hate_speech', label: 'Hate speech', description: 'Promoting violence against people' },
  { value: 'violence', label: 'Violence or threats', description: 'Physical threats or graphic violence' },
  { value: 'misinformation', label: 'Misinformation', description: 'False or misleading information' },
  { value: 'inappropriate', label: 'Inappropriate content', description: 'NSFW or offensive content' },
  { value: 'impersonation', label: 'Impersonation', description: 'Pretending to be someone else' },
  { value: 'self_harm', label: 'Self-harm or suicide', description: 'Content promoting self-harm' },
  { value: 'other', label: 'Other', description: 'Something else' },
];

export function ReportModal({
  isOpen,
  onClose,
  targetUserId,
  targetUsername,
  targetDisplayName,
  targetProfileImageUrl,
  postId,
  onSuccess,
}: ReportModalProps) {
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [isReporting, startReporting] = useTransition();

  const displayName = targetDisplayName || targetUsername || 'User';

  const handleReport = () => {
    if (!category) {
      toast.error('Please select a report category');
      return;
    }

    if (reason.length < 10) {
      toast.error('Please provide more details (at least 10 characters)');
      return;
    }

    startReporting(async () => {
      const response = await fetch('/api/moderation/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: postId ? 'post' : 'user',
          reportedUserId: postId ? undefined : targetUserId,
          reportedPostId: postId,
          category,
          reason,
          evidence: evidence || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Failed to submit report');
        return;
      }

      toast.success('Report submitted successfully. Our team will review it.');
      
      // Reset form
      setCategory('');
      setReason('');
      setEvidence('');
      
      onClose();
      onSuccess?.();
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl w-full my-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-500" />
            Report {postId ? 'Post' : 'User'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-3 mb-6 p-3 bg-muted/50 rounded-lg">
          <Avatar
            src={targetProfileImageUrl}
            alt={displayName}
            size="md"
          />
          <div>
            <div className="font-medium">{displayName}</div>
            {targetUsername && (
              <div className="text-sm text-muted-foreground">@{targetUsername}</div>
            )}
          </div>
        </div>

        {/* Warning */}
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-orange-500 mb-1">Important</p>
            <p className="text-muted-foreground">
              Filing false reports may result in your account being restricted. Only report content that violates our community guidelines.
            </p>
          </div>
        </div>

        {/* Category Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            What's the issue? <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {REPORT_CATEGORIES.map((cat) => (
              <label
                key={cat.value}
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  category === cat.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="category"
                  value={cat.value}
                  checked={category === cat.value}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium">{cat.label}</div>
                  <div className="text-sm text-muted-foreground">{cat.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Please provide details <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe what happened and why you're reporting this..."
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary resize-none"
            rows={4}
            minLength={10}
            maxLength={2000}
          />
          <div className="text-xs text-muted-foreground mt-1">
            {reason.length}/2000 characters (minimum 10)
          </div>
        </div>

        {/* Evidence URL */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Evidence (optional)
          </label>
          <input
            type="url"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="https://example.com/screenshot.png"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          />
          <div className="text-xs text-muted-foreground mt-1">
            Link to screenshot or additional evidence
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isReporting}
            className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReport}
            disabled={isReporting || !category || reason.length < 10}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isReporting ? (
              <>Submitting...</>
            ) : (
              <>
                <Flag className="w-4 h-4" />
                Submit Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


