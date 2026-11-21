import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  RefreshCw,
  ShoppingBag,
  Store as StoreIcon,
  Trash2,
  User as UserIcon,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  AdminModuleType,
  filterPendingAdminItems,
  getAdminModuleLabel,
  PendingAdminItem,
} from '../../lib/adminHelpers';
import {
  approvePendingItem,
  fetchPendingApprovals,
  rejectPendingItem,
} from '../../lib/adminService';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { ProductImage } from '../../components/marketplace/ProductImage';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/feedback/ErrorState';

const MODULE_FILTERS: Array<{ id: 'all' | AdminModuleType; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'item', label: 'Item' },
  { id: 'service', label: 'Service' },
  { id: 'room', label: 'Room' },
  { id: 'roommate', label: 'Roommate' },
  { id: 'store', label: 'Store' },
];

function AdminModuleBadge({ type }: { type: AdminModuleType }) {
  const label = getAdminModuleLabel(type);
  switch (type) {
    case 'service':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Wrench className="w-3 h-3" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'room':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
          <Building2 className="w-3 h-3" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'roommate':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
          <Users className="w-3 h-3" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'store':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <StoreIcon className="w-3 h-3" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
    case 'item':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <ShoppingBag className="w-3 h-3" aria-hidden="true" />
          <span>{label}</span>
        </span>
      );
  }
}

export function AdminListings() {
  const { showToast } = useToast();
  const [items, setItems] = useState<PendingAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<'all' | AdminModuleType>('all');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingAdminItem | null>(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPendingApprovals();
      setItems(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load pending approvals.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  useEffect(() => {
    if (!rejectTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyKey) {
        setRejectTarget(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rejectTarget, busyKey]);

  const filterCounts = useMemo(() => {
    const counts: Record<'all' | AdminModuleType, number> = {
      all: items.length,
      item: 0,
      service: 0,
      room: 0,
      roommate: 0,
      store: 0,
    };
    for (const item of items) {
      counts[item._type] += 1;
    }
    return counts;
  }, [items]);

  const visibleItems = useMemo(
    () => filterPendingAdminItems(items, moduleFilter),
    [items, moduleFilter]
  );

  const handleApprove = async (item: PendingAdminItem) => {
    const key = `${item.collectionName}:${item.id}`;
    if (busyKey) return;
    setBusyKey(key);
    try {
      await approvePendingItem(item);
      setItems((prev) =>
        prev.filter(
          (row) =>
            !(row.id === item.id && row.collectionName === item.collectionName)
        )
      );
      showToast(`Approved "${item.title}" and notified owner.`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to approve item.',
        'error'
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget || busyKey) return;
    const key = `${rejectTarget.collectionName}:${rejectTarget.id}`;
    setBusyKey(key);
    try {
      await rejectPendingItem(rejectTarget);
      setItems((prev) =>
        prev.filter(
          (row) =>
            !(
              row.id === rejectTarget.id &&
              row.collectionName === rejectTarget.collectionName
            )
        )
      );
      showToast(`Rejected and removed "${rejectTarget.title}".`, 'info');
      setRejectTarget(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to reject item.',
        'error'
      );
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <AdminLayout
      title="Pending Approvals"
      subtitle="Review unapproved Items, Services, Accommodation rooms, Roommate posts, and Campus Stores."
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
              className="bg-white rounded-xl border border-slate-200 p-5 flex gap-4 animate-pulse"
            >
              <div className="w-24 h-24 rounded-lg bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-2.5">
                <div className="h-4 w-24 bg-slate-200 rounded" />
                <div className="h-5 w-1/2 bg-slate-200 rounded" />
                <div className="h-4 w-2/3 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load pending approvals"
          message={error}
          onRetry={() => void loadPending()}
        />
      ) : (
        <div className="space-y-4">
          {/* Module Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {MODULE_FILTERS.map((tab) => {
              const selected = moduleFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setModuleFilter(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors ${
                    selected
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-xs tabular-nums ${
                      selected ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {filterCounts[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>

          {visibleItems.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h2 className="text-lg font-bold text-slate-900">
                All caught up!
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                There are no pending{' '}
                {moduleFilter === 'all'
                  ? 'listings'
                  : getAdminModuleLabel(moduleFilter).toLowerCase()}{' '}
                waiting for approval right now.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleItems.map((item) => {
                const key = `${item.collectionName}:${item.id}`;
                const isBusy = busyKey === key;

                return (
                  <article
                    key={key}
                    className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 transition-shadow hover:shadow-sm"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                          <ProductImage
                            src={item.thumbnail}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            iconClassName="w-7 h-7 text-slate-400"
                          />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <AdminModuleBadge type={item._type} />
                            {item.needsAiReview && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                                Needs Review
                              </span>
                            )}
                            <span className="text-xs font-semibold text-primary-700 tabular-nums">
                              {item.priceOrSubtitle}
                            </span>
                          </div>

                          <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                            {item.title}
                          </h2>

                          <p className="text-xs sm:text-sm text-slate-600 line-clamp-2">
                            {item.description}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-0.5">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                              <span>{item.ownerName}</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{item.locationLabel}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 shrink-0">
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={Boolean(busyKey)}
                          onClick={() => setRejectTarget(item)}
                          className="min-h-[40px]"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Reject / Delete</span>
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={Boolean(busyKey)}
                          onClick={() => void handleApprove(item)}
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
          )}
        </div>
      )}

      {/* Reject & Delete Confirmation Modal */}
      {rejectTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => {
            if (!busyKey) setRejectTarget(null);
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
                    id="reject-modal-title"
                    className="text-lg font-bold text-slate-900"
                  >
                    Reject &amp; Delete Submission?
                  </h2>
                  <p className="text-xs text-slate-500">
                    The owner will receive a rejection notification.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(busyKey)}
                onClick={() => setRejectTarget(null)}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              You are about to permanently remove{' '}
              <span className="font-semibold text-slate-900">
                &ldquo;{rejectTarget.title}&rdquo;
              </span>{' '}
              ({getAdminModuleLabel(rejectTarget._type)}) from LASUEDPLUG.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="md"
                disabled={Boolean(busyKey)}
                onClick={() => setRejectTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                disabled={Boolean(busyKey)}
                onClick={() => void handleConfirmReject()}
              >
                {busyKey ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Reject &amp; Delete</span>
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
