import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Calendar,
  Check,
  CheckCircle2,
  Expand,
  Loader2,
  RefreshCw,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  areAllVisibleSelected,
  toggleBulkSelectionKey,
  toggleSelectAllVisibleKeys,
} from '../../lib/adminHelpers';
import { formatVerificationDate } from '../../lib/verificationHelpers';
import {
  approveVerificationRequest,
  bulkApproveVerificationRequests,
  bulkRejectVerificationRequests,
  fetchPendingVerificationRequests,
  rejectVerificationRequest,
} from '../../lib/verificationService';
import { VerificationRequest } from '../../types';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/feedback/ErrorState';

export function AdminVerifications() {
  const { showToast } = useToast();

  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewRequest, setPreviewRequest] =
    useState<VerificationRequest | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPendingVerificationRequests();
      setRequests(data);
      setSelectedIds([]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load pending student verification requests.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  useEffect(() => {
    if (!previewRequest && !bulkRejectOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !bulkAction) {
        setPreviewRequest(null);
        setBulkRejectOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewRequest, bulkRejectOpen, bulkAction]);

  const visibleIds = useMemo(
    () => requests.map((r) => r.id).filter((id): id is string => Boolean(id)),
    [requests]
  );

  const allSelected = useMemo(
    () => areAllVisibleSelected(selectedIds, visibleIds),
    [selectedIds, visibleIds]
  );

  const selectedRequests = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return requests.filter((req) => Boolean(req.id && selectedSet.has(req.id)));
  }, [requests, selectedIds]);

  const handleApprove = async (req: VerificationRequest) => {
    if (!req.id || busyId || bulkAction) return;
    setBusyId(req.id);
    try {
      await approveVerificationRequest(req);
      setRequests((prev) => prev.filter((item) => item.id !== req.id));
      setSelectedIds((prev) => prev.filter((id) => id !== req.id));
      if (previewRequest?.id === req.id) {
        setPreviewRequest(null);
      }
      showToast(`Verified ${req.fullName}! Green badge is now active.`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Failed to approve verification request.',
        'error'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (req: VerificationRequest) => {
    if (!req.id || busyId || bulkAction) return;
    setBusyId(req.id);
    try {
      await rejectVerificationRequest(req);
      setRequests((prev) => prev.filter((item) => item.id !== req.id));
      setSelectedIds((prev) => prev.filter((id) => id !== req.id));
      if (previewRequest?.id === req.id) {
        setPreviewRequest(null);
      }
      showToast(`Rejected verification request for ${req.fullName}.`, 'info');
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Failed to reject verification request.',
        'error'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRequests.length === 0 || busyId || bulkAction) return;
    setBulkAction('approve');
    try {
      const { succeeded, failedCount } =
        await bulkApproveVerificationRequests(selectedRequests);
      const succeededIds = new Set(
        succeeded.map((r) => r.id).filter((id): id is string => Boolean(id))
      );
      if (succeededIds.size > 0) {
        setRequests((prev) =>
          prev.filter((item) => !item.id || !succeededIds.has(item.id))
        );
        setSelectedIds((prev) => prev.filter((id) => !succeededIds.has(id)));
      }
      if (failedCount === 0) {
        showToast(
          `Approved & verified ${succeeded.length} ${succeeded.length === 1 ? 'student' : 'students'}!`,
          'success'
        );
      } else {
        showToast(
          `Verified ${succeeded.length}, failed ${failedCount}. Please retry remaining requests.`,
          'error'
        );
      }
    } finally {
      setBulkAction(null);
    }
  };

  const handleConfirmBulkReject = async () => {
    if (selectedRequests.length === 0 || busyId || bulkAction) return;
    setBulkAction('reject');
    try {
      const { succeeded, failedCount } =
        await bulkRejectVerificationRequests(selectedRequests);
      const succeededIds = new Set(
        succeeded.map((r) => r.id).filter((id): id is string => Boolean(id))
      );
      if (succeededIds.size > 0) {
        setRequests((prev) =>
          prev.filter((item) => !item.id || !succeededIds.has(item.id))
        );
        setSelectedIds((prev) => prev.filter((id) => !succeededIds.has(id)));
      }
      setBulkRejectOpen(false);
      if (failedCount === 0) {
        showToast(
          `Rejected ${succeeded.length} verification ${succeeded.length === 1 ? 'request' : 'requests'}.`,
          'info'
        );
      } else {
        showToast(
          `Rejected ${succeeded.length}, failed ${failedCount}. Please retry remaining requests.`,
          'error'
        );
      }
    } finally {
      setBulkAction(null);
    }
  };

  return (
    <AdminLayout
      title="Student Verifications"
      subtitle="Review uploaded Student ID cards and School Fee receipts to grant the Verified Student badge."
      actionSlot={
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadPending()}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row gap-4 animate-pulse"
            >
              <div className="w-full sm:w-48 h-32 rounded-lg bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2.5">
                <div className="h-4 w-28 bg-slate-200 rounded" />
                <div className="h-5 w-1/2 bg-slate-200 rounded" />
                <div className="h-4 w-1/3 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load verification requests"
          message={error}
          onRetry={() => void loadPending()}
        />
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2.5">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">
            No pending verification requests
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            All student ID cards and school fee receipt submissions have been reviewed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Select All Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200">
            <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={Boolean(busyId || bulkAction)}
                onChange={() =>
                  setSelectedIds((prev) =>
                    toggleSelectAllVisibleKeys(prev, visibleIds)
                  )
                }
                className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-blue-500"
              />
              <span>
                Select All ({requests.length} pending{' '}
                {requests.length === 1 ? 'request' : 'requests'})
              </span>
            </label>

            {selectedRequests.length > 0 && (
              <button
                type="button"
                disabled={Boolean(bulkAction)}
                onClick={() => setSelectedIds([])}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50"
              >
                Clear selection
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {requests.map((req) => {
              const reqId = req.id || '';
              const isBusy = busyId === reqId;
              const isSelected = Boolean(reqId && selectedIds.includes(reqId));

              return (
                <article
                  key={req.id || req.userId}
                  className={`bg-white rounded-xl border p-4 sm:p-5 transition-all hover:shadow-sm ${
                    isSelected
                      ? 'border-primary-400 ring-1 ring-primary-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                      {reqId && (
                        <label className="pt-1 flex items-center shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={Boolean(busyId || bulkAction)}
                            aria-label={`Select ${req.fullName}`}
                            onChange={() =>
                              setSelectedIds((prev) =>
                                toggleBulkSelectionKey(prev, reqId)
                              )
                            }
                            className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-blue-500"
                          />
                        </label>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setPreviewRequest(req)}
                          aria-label={`Inspect ID document for ${req.fullName}`}
                          className="group relative w-full sm:w-48 h-36 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <img
                            src={req.idCardImage}
                            alt={`Student ID document submitted by ${req.fullName}`}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900/75 text-white text-[11px] font-medium">
                            <Expand className="w-3 h-3" aria-hidden="true" />
                            <span>Zoom</span>
                          </span>
                        </button>

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Pending Verification</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                              <span>Submitted {formatVerificationDate(req.createdAt)}</span>
                            </span>
                          </div>

                          <h2 className="text-lg font-bold text-slate-900 truncate">
                            {req.fullName}
                          </h2>

                          <p className="text-xs text-slate-500 flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              User ID:{' '}
                              <span className="font-mono text-slate-700">
                                {req.userId}
                              </span>
                            </span>
                          </p>

                          <p className="text-xs text-slate-600">
                            Confirm the name on the uploaded Student ID or School Fee Receipt matches{' '}
                            <span className="font-semibold text-slate-800">
                              {req.fullName}
                            </span>
                            .
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={Boolean(busyId || bulkAction)}
                        onClick={() => void handleReject(req)}
                        className="min-h-[40px] border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        disabled={Boolean(busyId || bulkAction)}
                        onClick={() => void handleApprove(req)}
                        className="min-h-[40px] bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500"
                      >
                        {isBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        <span>Approve</span>
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Sticky Bottom Bulk Action Bar */}
          {selectedRequests.length > 0 && (
            <div
              role="region"
              aria-label="Bulk verification actions"
              data-testid="verifications-bulk-action-bar"
              className="sticky bottom-16 md:bottom-4 z-40 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <p className="text-sm font-semibold tabular-nums">
                {selectedRequests.length}{' '}
                {selectedRequests.length === 1 ? 'request' : 'requests'} selected
              </p>
              <div className="flex items-center gap-2.5">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={Boolean(bulkAction || busyId)}
                  onClick={() => setBulkRejectOpen(true)}
                  className="min-h-[40px]"
                >
                  {bulkAction === 'reject' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  <span>Reject Selected</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={Boolean(bulkAction || busyId)}
                  onClick={() => void handleBulkApprove()}
                  className="min-h-[40px] bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-400"
                >
                  {bulkAction === 'approve' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Approve Selected</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enlarged Document Preview Modal */}
      {previewRequest && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="id-preview-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
          onClick={() => setPreviewRequest(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div>
                <h2
                  id="id-preview-modal-title"
                  className="text-base font-bold text-slate-900"
                >
                  {previewRequest.fullName} — Verification Document
                </h2>
                <p className="text-xs text-slate-500">
                  Submitted {formatVerificationDate(previewRequest.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewRequest(null)}
                aria-label="Close document preview"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 flex items-center justify-center p-4 max-h-[65vh] overflow-auto">
              <img
                src={previewRequest.idCardImage}
                alt={`Full document for ${previewRequest.fullName}`}
                loading="lazy"
                decoding="async"
                className="max-w-full max-h-[58vh] object-contain rounded-lg"
              />
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                disabled={Boolean(busyId)}
                onClick={() => void handleReject(previewRequest)}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <X className="w-4 h-4" />
                <span>Reject</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={Boolean(busyId)}
                onClick={() => void handleApprove(previewRequest)}
                className="bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500"
              >
                {busyId === previewRequest.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Approve &amp; Verify Student</span>
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Reject Confirmation Modal */}
      {bulkRejectOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-reject-verify-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => {
            if (!bulkAction) setBulkRejectOpen(false);
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <X className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="bulk-reject-verify-title"
                    className="text-lg font-bold text-slate-900"
                  >
                    Reject {selectedRequests.length} Verification{' '}
                    {selectedRequests.length === 1 ? 'Request' : 'Requests'}?
                  </h2>
                  <p className="text-xs text-slate-500">
                    Each student will receive a notification to re-upload a clearer document.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(bulkAction)}
                onClick={() => setBulkRejectOpen(false)}
                aria-label="Close bulk reject modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              You are about to reject{' '}
              <span className="font-semibold text-slate-900">
                {selectedRequests.length} pending verification{' '}
                {selectedRequests.length === 1 ? 'submission' : 'submissions'}
              </span>
              .
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="md"
                disabled={Boolean(bulkAction)}
                onClick={() => setBulkRejectOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                disabled={Boolean(bulkAction)}
                onClick={() => void handleConfirmBulkReject()}
              >
                {bulkAction === 'reject' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    <span>Reject Selected</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
