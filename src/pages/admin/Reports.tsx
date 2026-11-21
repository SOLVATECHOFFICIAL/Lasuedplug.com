import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  CheckCircle2,
  ExternalLink,
  Eye,
  Flag,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Trash2,
  User as UserIcon,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { EnrichedReport } from '../../lib/adminHelpers';
import {
  banReportedUserAndResolve,
  deleteReportTargetAndResolve,
  dismissReport,
  getEnrichedOpenReports,
  suspendReportedUserAndResolve,
} from '../../lib/adminService';
import { formatNotificationTime } from '../../lib/notificationHelpers';
import { Report } from '../../types';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/feedback/ErrorState';

type ModalActionKind = 'dismiss' | 'delete' | 'suspend' | 'ban';

function formatReportTargetType(targetType: Report['targetType']): string {
  switch (targetType) {
    case 'product':
      return 'Product / Item';
    case 'service':
      return 'Service';
    case 'accommodation':
      return 'Accommodation';
    case 'roommate_request':
      return 'Roommate Post';
    case 'store':
      return 'Store';
    case 'user':
      return 'User Account';
    default:
      return targetType;
  }
}

export function AdminReports() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [reports, setReports] = useState<EnrichedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<EnrichedReport | null>(
    null
  );
  const [busyAction, setBusyAction] = useState<ModalActionKind | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEnrichedOpenReports();
      setReports(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load reports.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (!selectedReport) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyAction) {
        setSelectedReport(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedReport, busyAction]);

  const removeReportFromList = (reportId?: string) => {
    if (!reportId) return;
    setReports((prev) => prev.filter((item) => item.report.id !== reportId));
  };

  const handleDismiss = async () => {
    const reportId = selectedReport?.report.id;
    if (!reportId || busyAction) return;
    setBusyAction('dismiss');
    try {
      await dismissReport(reportId);
      removeReportFromList(reportId);
      setSelectedReport(null);
      showToast('Report dismissed.', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to dismiss report.',
        'error'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteListing = async () => {
    if (!selectedReport?.report.id || busyAction) return;
    if (selectedReport.report.targetType === 'user') {
      showToast('Cannot delete a user account directly. Use Suspend or Ban.', 'info');
      return;
    }

    setBusyAction('delete');
    try {
      await deleteReportTargetAndResolve(selectedReport.report);
      removeReportFromList(selectedReport.report.id);
      setSelectedReport(null);
      showToast('Reported listing deleted and report resolved.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Failed to delete reported listing.',
        'error'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleSuspendUser = async () => {
    if (!selectedReport?.report.id || busyAction) return;
    const offenderId = selectedReport.offenderId;
    if (!offenderId) {
      showToast('Offending user could not be identified for this report.', 'error');
      return;
    }
    if (offenderId === currentUser?.uid) {
      showToast('You cannot suspend your own admin account.', 'info');
      return;
    }

    setBusyAction('suspend');
    try {
      await suspendReportedUserAndResolve(selectedReport.report.id, offenderId);
      removeReportFromList(selectedReport.report.id);
      setSelectedReport(null);
      showToast(
        `${selectedReport.offenderName} suspended, all their listings hidden, and report resolved.`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to suspend user.',
        'error'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleBanUser = async () => {
    if (!selectedReport?.report.id || busyAction) return;
    const offenderId = selectedReport.offenderId;
    if (!offenderId) {
      showToast('Offending user could not be identified for this report.', 'error');
      return;
    }
    if (offenderId === currentUser?.uid) {
      showToast('You cannot ban your own admin account.', 'info');
      return;
    }

    setBusyAction('ban');
    try {
      await banReportedUserAndResolve(selectedReport.report.id, offenderId);
      removeReportFromList(selectedReport.report.id);
      setSelectedReport(null);
      showToast(
        `${selectedReport.offenderName} permanently banned, listings hidden, and report resolved.`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to ban user.',
        'error'
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <AdminLayout
      title="Content Reports"
      subtitle="Review open reports, inspect reported listings and users, and take reversible or permanent moderation action."
      actionSlot={
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadReports()}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 h-24 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load open reports"
          message={error}
          onRetry={() => void loadReports()}
        />
      ) : reports.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            No open reports
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            All flagged content has been reviewed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((item) => {
            const { report } = item;
            return (
              <article
                key={report.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary-300 dark:hover:border-primary-600 transition-colors overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setSelectedReport(item)}
                  aria-label={`Review report for ${item.listingTitle}`}
                  className="w-full text-left p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/70">
                        <Flag className="w-3 h-3" aria-hidden="true" />
                        <span>{formatReportTargetType(report.targetType)}</span>
                      </span>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                        {item.listingTitle}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        · {formatNotificationTime(report.createdAt)}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
                      {report.reason}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        Reporter: <strong className="font-medium text-slate-700 dark:text-slate-200">{item.reporterName}</strong>
                      </span>
                      <span>
                        Offender: <strong className="font-medium text-slate-700 dark:text-slate-200">{item.offenderName}</strong>
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center justify-end shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/70">
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Review Report</span>
                    </span>
                  </div>
                </button>
              </article>
            );
          })}
        </div>
      )}

      {/* Moderation Detail Modal */}
      {selectedReport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm"
          onClick={() => {
            if (!busyAction) setSelectedReport(null);
          }}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Flag className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="report-modal-title"
                    className="text-lg font-bold text-slate-900 dark:text-white"
                  >
                    Review Report
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatReportTargetType(selectedReport.report.targetType)} ·{' '}
                    {formatNotificationTime(selectedReport.report.createdAt)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() => setSelectedReport(null)}
                aria-label="Close report modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Report Details */}
            <div className="space-y-3.5 text-sm">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Reporter
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white text-right">
                    {selectedReport.reporterName}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-700">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Offender
                  </span>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {selectedReport.offenderName}
                    </span>
                    {selectedReport.offenderStatus === 'suspended' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/70">
                        <ShieldAlert className="w-3 h-3" />
                        <span>Suspended</span>
                      </span>
                    )}
                    {selectedReport.offenderIsBanned && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-900 dark:bg-slate-700 text-white">
                        <Ban className="w-3 h-3" />
                        <span>Banned</span>
                      </span>
                    )}
                    {selectedReport.offenderProfileUrl && (
                      <Link
                        to={selectedReport.offenderProfileUrl}
                        onClick={() => setSelectedReport(null)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2"
                      >
                        <UserIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>View Profile</span>
                      </Link>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-700">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Reported Listing
                  </span>
                  <div className="flex items-center gap-2 flex-wrap justify-end min-w-0">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                      {selectedReport.listingTitle}
                    </span>
                    {selectedReport.listingUrl && (
                      <Link
                        to={selectedReport.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <span>View Listing</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Reason Provided
                </p>
                <div className="rounded-xl bg-red-50/70 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/70 p-3.5 text-sm text-slate-900 dark:text-red-100 leading-relaxed">
                  {selectedReport.report.reason}
                </div>
              </div>
            </div>

            {/* 4 Moderation Action Buttons */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Moderation Actions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Button
                  variant="outline"
                  size="md"
                  disabled={Boolean(busyAction)}
                  onClick={() => void handleDismiss()}
                >
                  {busyAction === 'dismiss' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Dismiss</span>
                </Button>

                <Button
                  variant="danger"
                  size="md"
                  disabled={
                    Boolean(busyAction) ||
                    selectedReport.report.targetType === 'user'
                  }
                  onClick={() => void handleDeleteListing()}
                >
                  {busyAction === 'delete' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>Delete Listing</span>
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  disabled={Boolean(busyAction) || !selectedReport.offenderId}
                  onClick={() => void handleSuspendUser()}
                >
                  {busyAction === 'suspend' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserX className="w-4 h-4" />
                  )}
                  <span>Suspend User</span>
                </Button>

                <Button
                  variant="danger"
                  size="md"
                  disabled={Boolean(busyAction) || !selectedReport.offenderId}
                  onClick={() => void handleBanUser()}
                >
                  {busyAction === 'ban' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  <span>Ban User</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
