import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckSquare,
  Clock,
  Flag,
  Globe,
  GraduationCap,
  Layers,
  RefreshCw,
  ShieldAlert,
  Store,
  Users,
} from 'lucide-react';
import {
  AdminDashboardStats,
  getAdminModuleLabel,
} from '../../lib/adminHelpers';
import { isMarketerProfile } from '../../lib/authHelpers';
import {
  EnhancedAdminOverview,
  getEnhancedAdminOverview,
} from '../../lib/adminService';
import { getFastCache, setFastCache } from '../../lib/fastCache';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/feedback/ErrorState';

const EMPTY_STATS: AdminDashboardStats = {
  totalUsers: 0,
  studentUsers: 0,
  marketerUsers: 0,
  verifiedUsers: 0,
  verifiedStudents: 0,
  verifiedMarketers: 0,
  physicalShopMarketers: 0,
  onlineOnlyMarketers: 0,
  suspendedUsers: 0,
  bannedUsers: 0,
  totalListings: 0,
  pendingApprovals: 0,
  pendingVerifications: 0,
  openReports: 0,
  moduleBreakdown: {
    itemsTotal: 0,
    itemsPending: 0,
    servicesTotal: 0,
    servicesPending: 0,
    roomsTotal: 0,
    roomsPending: 0,
    roommatesTotal: 0,
    roommatesPending: 0,
    storesTotal: 0,
    storesPending: 0,
  },
};

export function AdminIndex() {
  const initialCached = getFastCache<EnhancedAdminOverview>('admin_overview');
  const [overview, setOverview] = useState<EnhancedAdminOverview>(
    () =>
      initialCached ?? {
        stats: EMPTY_STATS,
        recentPendingListings: [],
        recentVerifications: [],
        recentReports: [],
      }
  );
  const [loading, setLoading] = useState(() => !initialCached);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    const cached = getFastCache<EnhancedAdminOverview>('admin_overview');
    if (!cached) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await getEnhancedAdminOverview();
      setOverview(data);
      setFastCache('admin_overview', data);
      setFastCache('admin_stats', data.stats);
    } catch (err) {
      if (!cached) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load admin overview statistics.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const { stats, recentPendingListings, recentVerifications, recentReports } =
    overview;
  const studentCount = stats.studentUsers ?? 0;
  const marketerCount = stats.marketerUsers ?? 0;
  const verifiedUsers = stats.verifiedUsers ?? 0;
  const verifiedStudents = stats.verifiedStudents ?? 0;
  const verifiedMarketers = stats.verifiedMarketers ?? 0;
  const physicalShopMarketers = stats.physicalShopMarketers ?? 0;
  const onlineOnlyMarketers = stats.onlineOnlyMarketers ?? 0;
  const suspendedUsers = stats.suspendedUsers ?? 0;
  const pendingVerificationsCount = stats.pendingVerifications ?? 0;
  const totalModerationQueue =
    stats.pendingApprovals + pendingVerificationsCount + stats.openReports;
  const breakdown = stats.moduleBreakdown ?? EMPTY_STATS.moduleBreakdown!;

  const moduleRows = [
    {
      label: 'Items',
      total: breakdown.itemsTotal,
      pending: breakdown.itemsPending,
    },
    {
      label: 'Services',
      total: breakdown.servicesTotal,
      pending: breakdown.servicesPending,
    },
    {
      label: 'Accommodation',
      total: breakdown.roomsTotal,
      pending: breakdown.roomsPending,
    },
    {
      label: 'Roommates',
      total: breakdown.roommatesTotal,
      pending: breakdown.roommatesPending,
    },
    {
      label: 'Campus Stores',
      total: breakdown.storesTotal,
      pending: breakdown.storesPending,
    },
  ];

  return (
    <AdminLayout
      title="Admin Command Center"
      subtitle="Moderate Users (Students & Marketers), Listings, Identity Verifications, and Safety Reports across LASUEDPLUG."
      actionSlot={
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border tabular-nums ${
              totalModerationQueue > 0
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {totalModerationQueue > 0
                ? `${totalModerationQueue} items in moderation queue`
                : 'Moderation queue clear'}
            </span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadOverview()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 animate-pulse"
              >
                <div className="h-4 w-24 bg-slate-200 rounded" />
                <div className="h-8 w-16 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="h-56 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            <div className="h-56 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          </div>
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load admin metrics"
          message={error}
          onRetry={() => void loadOverview()}
        />
      ) : (
        <div className="space-y-6">
          {/* 4 Primary KPI Cards */}
          <section
            aria-label="Platform metrics"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <Link
              to="/admin/users"
              className="bg-white rounded-xl border border-slate-200 hover:border-primary-300 p-5 flex items-start justify-between gap-3 transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500">
                  Registered Users
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {stats.totalUsers.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-600 tabular-nums">
                  {studentCount.toLocaleString()} Students ·{' '}
                  {marketerCount.toLocaleString()} Marketers
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" aria-hidden="true" />
              </div>
            </Link>

            <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500">
                  Total Listings
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {stats.totalListings.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500">
                  Items, Services, Rooms, Roommates, Stores
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>

            <Link
              to="/admin/listings"
              className="bg-white rounded-xl border border-slate-200 hover:border-amber-300 p-5 flex items-start justify-between gap-3 transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500">
                  Pending Approvals
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-amber-700 tabular-nums">
                  {stats.pendingApprovals.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-600 tabular-nums">
                  + {pendingVerificationsCount.toLocaleString()} ID verifications
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <CheckSquare className="w-5 h-5" aria-hidden="true" />
              </div>
            </Link>

            <Link
              to="/admin/reports"
              className="bg-white rounded-xl border border-slate-200 hover:border-red-300 p-5 flex items-start justify-between gap-3 transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500">
                  Open Reports
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-red-700 tabular-nums">
                  {stats.openReports.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500 tabular-nums">
                  {suspendedUsers.toLocaleString()} suspended accounts
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-50 text-red-700 flex items-center justify-center shrink-0">
                <Flag className="w-5 h-5" aria-hidden="true" />
              </div>
            </Link>
          </section>

          {/* Two-Column Breakdown: Accounts Composition & Marketplace Modules */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Accounts Composition */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Students &amp; Marketers Breakdown
                  </h2>
                  <p className="text-xs text-slate-500">
                    {verifiedUsers.toLocaleString()} verified accounts total across campus
                  </p>
                </div>
                <Link
                  to="/admin/users"
                  className="text-xs font-semibold text-primary-600 hover:underline inline-flex items-center gap-1"
                >
                  <span>Manage All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  to="/admin/users?type=student"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <GraduationCap className="w-4 h-4 text-primary-600" />
                      <span>Students</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
                    {studentCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-600 tabular-nums">
                    {verifiedStudents.toLocaleString()} Verified Students
                  </p>
                </Link>

                <Link
                  to="/admin/users?type=business"
                  className="p-4 rounded-xl bg-indigo-50/70 hover:bg-indigo-50 border border-indigo-200 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                      <Store className="w-4 h-4 text-indigo-700" />
                      <span>Marketers</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <p className="text-2xl font-extrabold text-indigo-950 tabular-nums">
                    {marketerCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-indigo-800 tabular-nums">
                    {verifiedMarketers.toLocaleString()} Verified Marketers
                  </p>
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-1 text-center">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                  <div className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Physical Shop</span>
                  </div>
                  <p className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                    {physicalShopMarketers.toLocaleString()}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                  <div className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <Globe className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Online Only</span>
                  </div>
                  <p className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                    {onlineOnlyMarketers.toLocaleString()}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                  <div className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                    <span>Suspended</span>
                  </div>
                  <p className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                    {suspendedUsers.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Marketplace Modules Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Marketplace Modules
                  </h2>
                  <p className="text-xs text-slate-500">
                    Live vs pending submissions by category
                  </p>
                </div>
                <Link
                  to="/admin/listings"
                  className="text-xs font-semibold text-primary-600 hover:underline inline-flex items-center gap-1"
                >
                  <span>Review Queue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="divide-y divide-slate-100">
                {moduleRows.map((mod) => {
                  const approved = Math.max(0, mod.total - mod.pending);
                  return (
                    <div
                      key={mod.label}
                      className="py-2.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="font-semibold text-slate-800">
                        {mod.label}
                      </span>
                      <div className="flex items-center gap-2.5 tabular-nums">
                        <span className="text-xs text-slate-500">
                          {approved.toLocaleString()} live
                        </span>
                        {mod.pending > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                            {mod.pending.toLocaleString()} pending
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-900 min-w-[2.5rem] text-right">
                          {mod.total.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Live Needs Attention Now Action Previews */}
          <section aria-label="Needs attention now" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Needs Attention Now
              </h2>
              <span className="text-xs text-slate-500">
                Latest pending submissions across queues
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Pending Listings Preview */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-amber-600" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Pending Listings
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 tabular-nums">
                      {stats.pendingApprovals}
                    </span>
                  </div>

                  {recentPendingListings.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center bg-slate-50 rounded-xl">
                      No pending listings waiting for review.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recentPendingListings.slice(0, 4).map((item) => (
                        <Link
                          key={`${item.collectionName}:${item.id}`}
                          to="/admin/listings"
                          className="block p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50/60 border border-slate-200/80 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {item.title}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white border border-slate-200 text-slate-700 shrink-0">
                              {getAdminModuleLabel(item._type)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {item.ownerName} · {item.priceOrSubtitle}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <Link
                  to="/admin/listings"
                  className="inline-flex items-center justify-between text-xs font-semibold text-primary-600 hover:underline pt-2 border-t border-slate-100"
                >
                  <span>Open Pending Approvals ({stats.pendingApprovals})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Pending Verifications Preview */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-sm font-bold text-slate-900">
                        ID Verifications
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 tabular-nums">
                      {pendingVerificationsCount}
                    </span>
                  </div>

                  {recentVerifications.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center bg-slate-50 rounded-xl">
                      No pending ID verifications right now.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recentVerifications.slice(0, 4).map((req) => {
                        const isMarketer = isMarketerProfile(req);
                        return (
                          <Link
                            key={req.id || req.userId}
                            to="/admin/verifications"
                            className="block p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900 truncate">
                                {req.fullName}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                  isMarketer
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {isMarketer ? 'Marketer' : 'Student'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {req.documentType ||
                                (isMarketer ? 'Government ID' : 'Student ID / Receipt')}
                            </p>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Link
                  to="/admin/verifications"
                  className="inline-flex items-center justify-between text-xs font-semibold text-primary-600 hover:underline pt-2 border-t border-slate-100"
                >
                  <span>Review Verifications ({pendingVerificationsCount})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Open Reports Preview */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-red-600" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Open Reports
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-800 border border-red-200 tabular-nums">
                      {stats.openReports}
                    </span>
                  </div>

                  {recentReports.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center bg-slate-50 rounded-xl">
                      No open reports to resolve.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recentReports.slice(0, 4).map((rep) => (
                        <Link
                          key={rep.id}
                          to="/admin/reports"
                          className="block p-2.5 rounded-xl bg-slate-50 hover:bg-red-50/50 border border-slate-200/80 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900 capitalize truncate">
                              {rep.targetType.replace('_', ' ')} Report
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 shrink-0">
                              Open
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                            {rep.reason}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <Link
                  to="/admin/reports"
                  className="inline-flex items-center justify-between text-xs font-semibold text-primary-600 hover:underline pt-2 border-t border-slate-100"
                >
                  <span>Resolve Reports ({stats.openReports})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

