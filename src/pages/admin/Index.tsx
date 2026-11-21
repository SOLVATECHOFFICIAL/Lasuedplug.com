import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarPlus,
  CheckSquare,
  Clock,
  Flag,
  Globe,
  GraduationCap,
  Layers,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Store,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  AcademicSessionRolloverPlan,
} from '../../lib/academicData';
import {
  AdminDashboardStats,
  getAdminModuleLabel,
} from '../../lib/adminHelpers';
import { isMarketerProfile } from '../../lib/authHelpers';
import {
  EnhancedAdminOverview,
  getEnhancedAdminOverview,
  previewAcademicSessionRollover,
  promoteAllStudentsByOneSession,
} from '../../lib/adminService';
import { getFastCache, setFastCache } from '../../lib/fastCache';
import { PlatformSettings } from '../../lib/platformSettingsHelpers';
import { subscribeToPlatformSettings } from '../../lib/platformSettingsService';
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
  const { user } = useAuth();
  const { showToast } = useToast();
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

  const [sessionMeta, setSessionMeta] = useState<PlatformSettings>({
    maintenanceMode: false,
    academicSessionCount: 0,
  });
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [rolloverPlan, setRolloverPlan] =
    useState<AcademicSessionRolloverPlan | null>(null);
  const [rolloverModalOpen, setRolloverModalOpen] = useState(false);
  const [promotingSession, setPromotingSession] = useState(false);

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

  useEffect(() => {
    const unsub = subscribeToPlatformSettings((settings) => {
      setSessionMeta(settings);
    });
    return () => unsub();
  }, []);

  const handleOpenSessionPreview = async () => {
    if (loadingPreview || promotingSession) return;
    setLoadingPreview(true);
    try {
      const plan = await previewAcademicSessionRollover();
      setRolloverPlan(plan);
      setRolloverModalOpen(true);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Unable to calculate academic session rollover preview.',
        'error'
      );
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmSessionPromotion = async () => {
    if (promotingSession) return;
    setPromotingSession(true);
    try {
      const res = await promoteAllStudentsByOneSession(user?.email);
      setRolloverModalOpen(false);
      setRolloverPlan(null);
      showToast(
        res.promotedCount > 0
          ? `New session applied! ${res.promotedCount} student${res.promotedCount === 1 ? '' : 's'} upgraded (${res.graduatedCount} entered Graduate). Marketers untouched.`
          : `No active undergraduate levels to upgrade (${res.alreadyGraduateCount} already Graduate, ${res.marketersSkipped} Marketers untouched).`,
        'success'
      );
      await loadOverview();
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Failed to upgrade student levels for the new session.',
        'error'
      );
    } finally {
      setPromotingSession(false);
    }
  };

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
                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
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
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 animate-pulse"
              >
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="h-56 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
            <div className="h-56 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
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
          {/* Yearly Academic Session Rollover Banner (+1 Session for Students Only) */}
          <section
            aria-label="Academic session promotion banner"
            data-testid="admin-session-banner"
            className="rounded-2xl border border-indigo-200 dark:border-indigo-800/80 bg-gradient-to-r from-indigo-50 via-white to-blue-50 dark:from-indigo-950/60 dark:via-slate-900 dark:to-blue-950/50 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <GraduationCap className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    New Academic Session Rollover
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 tabular-nums">
                    Sessions Applied: {sessionMeta.academicSessionCount ?? 0}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Push every Student profile up by 1 year (LASUED: 100L–400L →{' '}
                  <strong className="text-slate-800 dark:text-white">Graduate</strong>; LASU: 100L–600L →{' '}
                  <strong className="text-slate-800 dark:text-white">Graduate</strong>). Graduates stay Graduate forever and Marketers are never affected.
                </p>
                {(sessionMeta.lastSessionPromotedCount ?? 0) > 0 && (
                  <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300 tabular-nums">
                    Last rollover: {sessionMeta.lastSessionPromotedCount} student(s) upgraded (
                    {sessionMeta.lastSessionGraduatedCount ?? 0} graduated)
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0">
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={loadingPreview || promotingSession}
                onClick={() => void handleOpenSessionPreview()}
                className="bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-500 w-full md:w-auto"
              >
                {loadingPreview ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Calculating...</span>
                  </>
                ) : (
                  <>
                    <CalendarPlus className="w-4 h-4" />
                    <span>+1 Session</span>
                  </>
                )}
              </Button>
            </div>
          </section>

          {/* 4 Primary KPI Cards */}
          <section
            aria-label="Platform metrics"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <Link
              to="/admin/users"
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary-300 dark:hover:border-primary-600 p-5 flex items-start justify-between gap-3 transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                  Registered Users
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {stats.totalUsers.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                  {studentCount.toLocaleString()} Students ·{' '}
                  {marketerCount.toLocaleString()} Marketers
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" aria-hidden="true" />
              </div>
            </Link>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                  Total Listings
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {stats.totalListings.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Items, Services, Rooms, Roommates, Stores
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>

            <Link
              to="/admin/listings"
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-600 p-5 flex items-start justify-between gap-3 transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                  Pending Approvals
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                  {stats.pendingApprovals.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                  + {pendingVerificationsCount.toLocaleString()} ID verifications
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <CheckSquare className="w-5 h-5" aria-hidden="true" />
              </div>
            </Link>

            <Link
              to="/admin/reports"
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-600 p-5 flex items-start justify-between gap-3 transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                  Open Reports
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-red-700 dark:text-red-400 tabular-nums">
                  {stats.openReports.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {suspendedUsers.toLocaleString()} suspended accounts
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 flex items-center justify-center shrink-0">
                <Flag className="w-5 h-5" aria-hidden="true" />
              </div>
            </Link>
          </section>

          {/* Two-Column Breakdown: Accounts Composition & Marketplace Modules */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Accounts Composition */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Students &amp; Marketers Breakdown
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {verifiedUsers.toLocaleString()} verified accounts total across campus
                  </p>
                </div>
                <Link
                  to="/admin/users"
                  className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>Manage All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  to="/admin/users?type=student"
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                      <GraduationCap className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      <span>Students</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {studentCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                    {verifiedStudents.toLocaleString()} Verified Students
                  </p>
                </Link>

                <Link
                  to="/admin/users?type=business"
                  className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      <Store className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
                      <span>Marketers</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <p className="text-2xl font-extrabold text-indigo-950 dark:text-white tabular-nums">
                    {marketerCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-indigo-800 dark:text-indigo-300 tabular-nums">
                    {verifiedMarketers.toLocaleString()} Verified Marketers
                  </p>
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-1 text-center">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                  <div className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>Physical Shop</span>
                  </div>
                  <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {physicalShopMarketers.toLocaleString()}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                  <div className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Online Only</span>
                  </div>
                  <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {onlineOnlyMarketers.toLocaleString()}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                  <div className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                    <span>Suspended</span>
                  </div>
                  <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {suspendedUsers.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Marketplace Modules Breakdown */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Marketplace Modules
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live vs pending submissions by category
                  </p>
                </div>
                <Link
                  to="/admin/listings"
                  className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>Review Queue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {moduleRows.map((mod) => {
                  const approved = Math.max(0, mod.total - mod.pending);
                  return (
                    <div
                      key={mod.label}
                      className="py-2.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {mod.label}
                      </span>
                      <div className="flex items-center gap-2.5 tabular-nums">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {approved.toLocaleString()} live
                        </span>
                        {mod.pending > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300">
                            {mod.pending.toLocaleString()} pending
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-900 dark:text-white min-w-[2.5rem] text-right">
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
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Needs Attention Now
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Latest pending submissions across queues
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Pending Listings Preview */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Pending Listings
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 tabular-nums">
                      {stats.pendingApprovals}
                    </span>
                  </div>

                  {recentPendingListings.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                      No pending listings waiting for review.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recentPendingListings.slice(0, 4).map((item) => (
                        <Link
                          key={`${item.collectionName}:${item.id}`}
                          to="/admin/listings"
                          className="block p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-amber-50/60 dark:hover:bg-amber-950/30 border border-slate-200/80 dark:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {item.title}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shrink-0">
                              {getAdminModuleLabel(item._type)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {item.ownerName} · {item.priceOrSubtitle}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <Link
                  to="/admin/listings"
                  className="inline-flex items-center justify-between text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline pt-2 border-t border-slate-100 dark:border-slate-800"
                >
                  <span>Open Pending Approvals ({stats.pendingApprovals})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Pending Verifications Preview */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        ID Verifications
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 tabular-nums">
                      {pendingVerificationsCount}
                    </span>
                  </div>

                  {recentVerifications.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center bg-slate-50 dark:bg-slate-800/60 rounded-xl">
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
                            className="block p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 border border-slate-200/80 dark:border-slate-700 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {req.fullName}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                  isMarketer
                                    ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                {isMarketer ? 'Marketer' : 'Student'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
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
                  className="inline-flex items-center justify-between text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline pt-2 border-t border-slate-100 dark:border-slate-800"
                >
                  <span>Review Verifications ({pendingVerificationsCount})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Open Reports Preview */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Open Reports
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 tabular-nums">
                      {stats.openReports}
                    </span>
                  </div>

                  {recentReports.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                      No open reports to resolve.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recentReports.slice(0, 4).map((rep) => (
                        <Link
                          key={rep.id}
                          to="/admin/reports"
                          className="block p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-red-50/50 dark:hover:bg-red-950/30 border border-slate-200/80 dark:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white capitalize truncate">
                              {rep.targetType.replace('_', ' ')} Report
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 shrink-0">
                              Open
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {rep.reason}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <Link
                  to="/admin/reports"
                  className="inline-flex items-center justify-between text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline pt-2 border-t border-slate-100 dark:border-slate-800"
                >
                  <span>Resolve Reports ({stats.openReports})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* +1 Academic Session Confirmation Dialog */}
      {rolloverModalOpen && rolloverPlan && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-rollover-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm"
          onClick={() => !promotingSession && setRolloverModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <CalendarPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="session-rollover-modal-title"
                    className="text-base font-bold text-slate-900 dark:text-white"
                  >
                    Confirm +1 Academic Session
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Students only · Marketers &amp; Graduates remain untouched
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={promotingSession}
                onClick={() => setRolloverModalOpen(false)}
                aria-label="Close session rollover dialog"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2.5 text-center">
                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80">
                  <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300">
                    Advancing Level
                  </p>
                  <p className="text-2xl font-extrabold text-indigo-950 dark:text-white tabular-nums mt-0.5">
                    {rolloverPlan.advancingCount}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80">
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                    Entering Graduate
                  </p>
                  <p className="text-2xl font-extrabold text-emerald-950 dark:text-white tabular-nums mt-0.5">
                    {rolloverPlan.graduatingCount}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Already Graduate
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {rolloverPlan.alreadyGraduateCount}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Marketers Untouched
                  </p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {rolloverPlan.marketersSkipped}
                  </p>
                </div>
              </div>

              {rolloverPlan.updates.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Preview ({rolloverPlan.updates.length} student
                    {rolloverPlan.updates.length === 1 ? '' : 's'} will update):
                  </p>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50">
                    {rolloverPlan.updates.slice(0, 12).map((u) => (
                      <div
                        key={u.uid}
                        className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-900 dark:text-white truncate block">
                            {u.fullName}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {u.campus}
                          </span>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums">
                          <span className="text-slate-500 dark:text-slate-400">{u.fromLevel}</span>{' '}
                          →{' '}
                          <span
                            className={
                              u.graduated ? 'text-emerald-700 dark:text-emerald-400' : 'text-indigo-700 dark:text-indigo-400'
                            }
                          >
                            {u.toLevel}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
                  No students with active 100L–600L levels to advance right now.
                </p>
              )}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={promotingSession}
                onClick={() => setRolloverModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={promotingSession || rolloverPlan.updates.length === 0}
                onClick={() => void handleConfirmSessionPromotion()}
                className="bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-500"
              >
                {promotingSession ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Upgrading Students...</span>
                  </>
                ) : (
                  <>
                    <CalendarPlus className="w-4 h-4" />
                    <span>
                      Confirm +1 Session ({rolloverPlan.updates.length})
                    </span>
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

