import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CheckSquare,
  Clock,
  Flag,
  Layers,
  RefreshCw,
  Users,
} from 'lucide-react';
import { AdminDashboardStats } from '../../lib/adminHelpers';
import { getAdminDashboardStats } from '../../lib/adminService';
import { useLoadCap, withLoadTimeout } from '../../lib/loadTimeout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/feedback/ErrorState';

export function AdminIndex() {
  const [stats, setStats] = useState<AdminDashboardStats>({
    totalUsers: 0,
    totalListings: 0,
    pendingApprovals: 0,
    openReports: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLoadCap(loading, () => setLoading(false));

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await withLoadTimeout(getAdminDashboardStats());
      setStats(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load admin overview statistics.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  return (
    <AdminLayout
      title="Admin Dashboard"
      subtitle="Platform moderation overview across Items, Services, Accommodation, Roommates, and Stores."
      actionSlot={
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadStats()}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      }
    >
      {loading ? (
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
      ) : error ? (
        <ErrorState
          title="Could not load admin metrics"
          message={error}
          onRetry={() => void loadStats()}
        />
      ) : (
        <div className="space-y-6">
          {/* 4 Stat Cards */}
          <section
            aria-label="Platform metrics"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500">
                  Total Users
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {stats.totalUsers.toLocaleString()}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500">
                  Total Listings
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                  {stats.totalListings.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-400">
                  Across all 4 modules
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500">
                  Pending Approvals
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-amber-700 tabular-nums">
                  {stats.pendingApprovals.toLocaleString()}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500">
                  Open Reports
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-red-700 tabular-nums">
                  {stats.openReports.toLocaleString()}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-50 text-red-700 flex items-center justify-center shrink-0">
                <Flag className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/admin/listings"
              className="group bg-white rounded-xl border border-slate-200 hover:border-primary-300 p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-sm"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <CheckSquare className="w-5 h-5" aria-hidden="true" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Review Pending Approvals
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Approve or reject new Items, Services, Accommodation rooms, Roommate posts, and Stores.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 group-hover:translate-x-0.5 transition-transform">
                <span>Open Queue ({stats.pendingApprovals})</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </Link>

            <Link
              to="/admin/verifications"
              className="group bg-white rounded-xl border border-slate-200 hover:border-primary-300 p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-sm"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <BadgeCheck className="w-5 h-5" aria-hidden="true" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Student Verifications
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Review uploaded Student ID cards and School Fee receipts to grant the Verified Student badge.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 group-hover:translate-x-0.5 transition-transform">
                <span>Review Requests</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </Link>

            <Link
              to="/admin/reports"
              className="group bg-white rounded-xl border border-slate-200 hover:border-primary-300 p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-sm"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-700 flex items-center justify-center">
                  <Flag className="w-5 h-5" aria-hidden="true" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Resolve Content Reports
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Inspect flagged listings or accounts, dismiss false flags, or remove violating content.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 group-hover:translate-x-0.5 transition-transform">
                <span>View Reports ({stats.openReports})</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </Link>

            <Link
              to="/admin/users"
              className="group bg-white rounded-xl border border-slate-200 hover:border-primary-300 p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-sm"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Users className="w-5 h-5" aria-hidden="true" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Manage Campus Users
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Search student accounts, check role assignments, and suspend or restore access.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 group-hover:translate-x-0.5 transition-transform">
                <span>Browse Users ({stats.totalUsers})</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </Link>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
