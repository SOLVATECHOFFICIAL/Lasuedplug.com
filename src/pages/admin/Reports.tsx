import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Flag,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  deleteReportTargetAndResolve,
  dismissReport,
  getOpenReports,
} from '../../lib/adminService';
import { formatNotificationTime } from '../../lib/notificationHelpers';
import { Report } from '../../types';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/feedback/ErrorState';

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
  const { showToast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOpenReports();
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
    if (!deleteTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyId) {
        setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteTarget, busyId]);

  const handleDismiss = async (report: Report) => {
    if (!report.id || busyId) return;
    setBusyId(report.id);
    try {
      await dismissReport(report.id);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      showToast('Report dismissed and marked as resolved.', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to dismiss report.',
        'error'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDeleteTarget = async () => {
    if (!deleteTarget?.id || busyId) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteReportTargetAndResolve(deleteTarget);
      setReports((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      showToast(
        deleteTarget.targetType === 'user'
          ? 'Reported user suspended and report resolved.'
          : 'Reported listing deleted and report resolved.',
        'success'
      );
      setDeleteTarget(null);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Failed to remove reported target.',
        'error'
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout
      title="Content Reports"
      subtitle="Review flagged listings, stores, and user reports across the platform."
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
              className="bg-white rounded-xl border border-slate-200 p-5 h-24 animate-pulse"
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
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">
            No open reports
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            All flagged content has been reviewed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const isBusy = busyId === report.id;
            return (
              <article
                key={report.id}
                className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                      <Flag className="w-3 h-3" />
                      <span>{formatReportTargetType(report.targetType)}</span>
                    </span>
                    <span className="text-xs text-slate-500 font-mono truncate">
                      Target ID: {report.targetId}
                    </span>
                    <span className="text-xs text-slate-400">
                      · {formatNotificationTime(report.createdAt)}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-slate-900">
                    {report.reason}
                  </p>
                  <p className="text-xs text-slate-500">
                    Reported by: <span className="font-mono">{report.reporterId}</span>
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={Boolean(busyId)}
                    onClick={() => void handleDismiss(report)}
                  >
                    {isBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : null}
                    <span>Dismiss</span>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={Boolean(busyId)}
                    onClick={() => setDeleteTarget(report)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {report.targetType === 'user'
                        ? 'Suspend User'
                        : 'Delete Target'}
                    </span>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-action-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => {
            if (!busyId) setDeleteTarget(null);
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="report-action-title"
                    className="text-lg font-bold text-slate-900"
                  >
                    {deleteTarget.targetType === 'user'
                      ? 'Suspend Reported User?'
                      : 'Delete Reported Content?'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    This resolves the report immediately.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => setDeleteTarget(null)}
                aria-label="Close dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Reason: &ldquo;<span className="font-semibold text-slate-900">{deleteTarget.reason}</span>&rdquo;
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="md"
                disabled={Boolean(busyId)}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                disabled={Boolean(busyId)}
                onClick={() => void handleConfirmDeleteTarget()}
              >
                {busyId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>
                    {deleteTarget.targetType === 'user'
                      ? 'Suspend User'
                      : 'Delete Target'}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
