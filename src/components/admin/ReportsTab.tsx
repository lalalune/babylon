/**
 * Admin Reports Tab
 * 
 * View and manage user reports
 */

'use client';

import { useEffect, useState, useTransition } from 'react';
import { Flag, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { Skeleton } from '@/components/shared/Skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ReportEvaluation {
  outcome: 'valid_report' | 'invalid_report' | 'abusive_reporter' | 'insufficient_evidence';
  confidence: number;
  reasoning: string;
  recommendedActions: string[];
  evidenceSummary: {
    chatMessages: number;
    posts: number;
    reportsReceived: number;
    reportsSent: number;
  };
}

interface Report {
  id: string;
  reportType: string;
  category: string;
  reason: string;
  evidence: string | null;
  status: string;
  priority: string;
  resolution: string | null;
  evaluation?: ReportEvaluation | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  reporter: {
    id: string;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
  };
  reportedUser: {
    id: string;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
    isBanned: boolean;
  } | null;
  resolver: {
    id: string;
    username: string | null;
    displayName: string | null;
  } | null;
}

interface ReportStats {
  totals: {
    total: number;
    pending: number;
    reviewing: number;
    resolved: number;
    dismissed: number;
  };
}

type StatusFilter = 'all' | 'pending' | 'reviewing' | 'resolved' | 'dismissed';
type PriorityFilter = 'all' | 'low' | 'normal' | 'high' | 'critical';

export function ReportsTab() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [evaluatingReportId, setEvaluatingReportId] = useState<string | null>(null);
  const [, startRefresh] = useTransition();

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, [statusFilter, priorityFilter]);

  const fetchReports = async (showRefreshing = false) => {
    const fetchLogic = async () => {
      const params = new URLSearchParams({
        limit: '100',
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);

      const response = await fetch(`/api/admin/reports?${params}`);
      if (!response.ok) throw new Error('Failed to fetch reports');
      
      const data = await response.json();
      setReports(data.reports || []);
      setLoading(false);
    };

    if (showRefreshing) {
      startRefresh(fetchLogic);
    } else {
      await fetchLogic();
    }
  };

  const fetchStats = async () => {
    const response = await fetch('/api/admin/reports/stats');
    if (!response.ok) return;
    
    const data = await response.json();
    setStats(data);
  };

  const handleAction = async (reportId: string, action: string, resolution: string) => {
    const response = await fetch(`/api/admin/reports/${reportId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, resolution }),
    });

    if (!response.ok) {
      const error = await response.json();
      toast.error(error.message || 'Failed to take action');
      return;
    }

    toast.success(`Report ${action} successfully`);
    setShowActionModal(false);
    setSelectedReport(null);
    fetchReports(true);
    fetchStats();
  };

  const handleEvaluate = async (reportId: string) => {
    setEvaluatingReportId(reportId);
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'evaluate' }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Failed to evaluate report');
        return;
      }

      const data = await response.json();
      toast.success('Report evaluated successfully');
      
      // Refresh reports to show evaluation
      await fetchReports(true);
      
      // Show evaluation modal if we have the report selected
      const report = reports.find(r => r.id === reportId);
      if (report && data.evaluation) {
        setSelectedReport({ ...report, evaluation: data.evaluation });
        setShowEvaluationModal(true);
      }
    } catch {
      toast.error('Failed to evaluate report');
    } finally {
      setEvaluatingReportId(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'hate_speech':
      case 'violence':
      case 'self_harm':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'harassment':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'spam':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      default:
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600 bg-red-600/10';
      case 'high':
        return 'text-orange-600 bg-orange-600/10';
      case 'normal':
        return 'text-blue-600 bg-blue-600/10';
      case 'low':
        return 'text-gray-600 bg-gray-600/10';
      default:
        return 'text-gray-600 bg-gray-600/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'reviewing':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'dismissed':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Total</div>
            <div className="text-2xl font-bold">{stats.totals.total}</div>
          </div>
          <div className="bg-card border border-yellow-500/20 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Pending</div>
            <div className="text-2xl font-bold text-yellow-500">{stats.totals.pending}</div>
          </div>
          <div className="bg-card border border-blue-500/20 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Reviewing</div>
            <div className="text-2xl font-bold text-blue-500">{stats.totals.reviewing}</div>
          </div>
          <div className="bg-card border border-green-500/20 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Resolved</div>
            <div className="text-2xl font-bold text-green-500">{stats.totals.resolved}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Dismissed</div>
            <div className="text-2xl font-bold">{stats.totals.dismissed}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground self-center">Status:</span>
          {(['all', 'pending', 'reviewing', 'resolved', 'dismissed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                statusFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground self-center">Priority:</span>
          {(['all', 'critical', 'high', 'normal', 'low'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                priorityFilter === p
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <Flag className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No reports found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Status Icon */}
                <div className="pt-1">
                  {getStatusIcon(report.status)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('px-2 py-0.5 text-xs font-medium rounded border', getCategoryColor(report.category))}>
                        {report.category.replace('_', ' ')}
                      </span>
                      <span className={cn('px-2 py-0.5 text-xs font-medium rounded', getPriorityColor(report.priority))}>
                        {report.priority}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-500/10 text-purple-500">
                        {report.reportType}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(report.createdAt)}
                    </div>
                  </div>

                  {/* Reporter & Reported User */}
                  <div className="flex items-center gap-4 mb-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={report.reporter.profileImageUrl || undefined}
                        alt={report.reporter.displayName || 'Reporter'}
                        size="sm"
                      />
                      <span className="text-muted-foreground">
                        {report.reporter.displayName || report.reporter.username} reported
                      </span>
                    </div>
                    {report.reportedUser && (
                      <>
                        <span className="text-muted-foreground">→</span>
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={report.reportedUser.profileImageUrl || undefined}
                            alt={report.reportedUser.displayName || 'Reported user'}
                            size="sm"
                          />
                          <span className="font-medium">
                            {report.reportedUser.displayName || report.reportedUser.username}
                          </span>
                          {report.reportedUser.isBanned && (
                            <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-500">
                              Banned
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Reason */}
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {report.reason}
                  </p>

                  {/* Evaluation Badge */}
                  {report.evaluation && (
                    <div className="mb-2">
                      <span className={cn(
                        'px-2 py-1 text-xs font-medium rounded',
                        report.evaluation.outcome === 'valid_report' ? 'bg-green-500/20 text-green-500' :
                        report.evaluation.outcome === 'abusive_reporter' ? 'bg-red-500/20 text-red-500' :
                        report.evaluation.outcome === 'invalid_report' ? 'bg-yellow-500/20 text-yellow-500' :
                        'bg-gray-500/20 text-gray-500'
                      )}>
                        {report.evaluation.outcome.replace('_', ' ')} ({Math.round(report.evaluation.confidence * 100)}%)
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  {report.status === 'pending' || report.status === 'reviewing' ? (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleEvaluate(report.id)}
                        disabled={evaluatingReportId === report.id}
                        className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors disabled:opacity-50"
                      >
                        {evaluatingReportId === report.id ? 'Evaluating...' : 'Evaluate'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedReport(report);
                          setShowActionModal(true);
                        }}
                        className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                      >
                        Take Action
                      </button>
                      <button
                        onClick={() => handleAction(report.id, 'dismiss', 'Dismissed by admin')}
                        className="px-3 py-1 text-sm bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm">
                      {report.evaluation && (
                        <button
                          onClick={() => {
                            setSelectedReport(report);
                            setShowEvaluationModal(true);
                          }}
                          className="text-primary hover:underline text-xs mb-2"
                        >
                          View Evaluation Details
                        </button>
                      )}
                      {report.resolution && (
                        <div className="text-muted-foreground">
                          <strong>Resolution:</strong> {report.resolution}
                        </div>
                      )}
                      {report.resolver && (
                        <div className="text-muted-foreground text-xs mt-1">
                          Resolved by {report.resolver.displayName || report.resolver.username}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {showActionModal && selectedReport && (
        <ActionModal
          report={selectedReport}
          onClose={() => {
            setShowActionModal(false);
            setSelectedReport(null);
          }}
          onAction={handleAction}
        />
      )}

      {/* Evaluation Modal */}
      {showEvaluationModal && selectedReport && selectedReport.evaluation && (
        <EvaluationModal
          report={selectedReport}
          evaluation={selectedReport.evaluation}
          onClose={() => {
            setShowEvaluationModal(false);
            setSelectedReport(null);
          }}
        />
      )}
    </div>
  );
}

interface ActionModalProps {
  report: Report;
  onClose: () => void;
  onAction: (reportId: string, action: string, resolution: string) => void;
}

interface EvaluationModalProps {
  report: Report;
  evaluation: ReportEvaluation;
  onClose: () => void;
}

function EvaluationModal({ report, evaluation, onClose }: EvaluationModalProps) {
  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'valid_report':
        return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'abusive_reporter':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'invalid_report':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      default:
        return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Report Evaluation</h2>

        {/* Evaluation Outcome */}
        <div className="mb-4">
          <div className={cn('px-4 py-3 rounded-lg border', getOutcomeColor(evaluation.outcome))}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-lg">
                {evaluation.outcome.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-sm">
                Confidence: {Math.round(evaluation.confidence * 100)}%
              </span>
            </div>
            <p className="text-sm mt-2">{evaluation.reasoning}</p>
          </div>
        </div>

        {/* Evidence Summary */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Evidence Collected</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Chat Messages</div>
              <div className="text-lg font-bold">{evaluation.evidenceSummary.chatMessages}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Posts</div>
              <div className="text-lg font-bold">{evaluation.evidenceSummary.posts}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Reports Received</div>
              <div className="text-lg font-bold">{evaluation.evidenceSummary.reportsReceived}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Reports Sent</div>
              <div className="text-lg font-bold">{evaluation.evidenceSummary.reportsSent}</div>
            </div>
          </div>
        </div>

        {/* Recommended Actions */}
        {evaluation.recommendedActions.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Recommended Actions</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {evaluation.recommendedActions.map((action, index) => (
                <li key={index}>{action}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Report Details */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Report Details</h3>
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p><strong>Category:</strong> {report.category.replace('_', ' ')}</p>
            <p><strong>Reason:</strong> {report.reason}</p>
            {report.evidence && (
              <p><strong>Evidence:</strong> <a href={report.evidence} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View</a></p>
            )}
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionModal({ report, onClose, onAction }: ActionModalProps) {
  const [action, setAction] = useState('resolve');
  const [resolution, setResolution] = useState('');
  const [isSubmitting, startSubmit] = useTransition();

  const handleSubmit = () => {
    if (!resolution.trim()) {
      toast.error('Please provide a resolution message');
      return;
    }

    startSubmit(() => {
      onAction(report.id, action, resolution);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Take Action on Report</h2>

        {/* Report Details */}
        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <p className="text-sm text-muted-foreground mb-2">
            <strong>Category:</strong> {report.category.replace('_', ' ')}
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            <strong>Reason:</strong> {report.reason}
          </p>
          {report.evidence && (
            <p className="text-sm text-muted-foreground">
              <strong>Evidence:</strong> <a href={report.evidence} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View</a>
            </p>
          )}
        </div>

        {/* Evaluation Info */}
        {report.evaluation && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">AI Evaluation</div>
            <div className="text-sm">
              <strong>Outcome:</strong> {report.evaluation.outcome.replace('_', ' ')} ({Math.round(report.evaluation.confidence * 100)}% confidence)
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Click "View Evaluation Details" in the report list to see full evaluation
            </p>
          </div>
        )}

        {/* Action Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg"
          >
            <option value="resolve">Resolve (content removed/warning issued)</option>
            <option value="ban_user">Ban User</option>
            <option value="escalate">Escalate to Critical</option>
            <option value="dismiss">Dismiss</option>
          </select>
        </div>

        {/* Resolution Message */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Resolution Message</label>
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Explain the action taken..."
            className="w-full px-3 py-2 bg-background border border-border rounded-lg resize-none"
            rows={4}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !resolution.trim()}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}


