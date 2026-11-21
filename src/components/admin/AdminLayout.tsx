import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckSquare,
  Flag,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { AdminAlertCounts, hasAnyAdminAlerts } from '../../lib/adminHelpers';
import { subscribeToAdminAlertCounts } from '../../lib/adminService';

interface AdminLayoutProps {
  title: string;
  subtitle?: string;
  actionSlot?: ReactNode;
  children: ReactNode;
}

const ADMIN_NAV_ITEMS = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
  {
    label: 'Pending Approvals',
    to: '/admin/listings',
    icon: CheckSquare,
    end: false,
  },
  {
    label: 'Verifications',
    to: '/admin/verifications',
    icon: BadgeCheck,
    end: false,
  },
  { label: 'Reports', to: '/admin/reports', icon: Flag, end: false },
  { label: 'Users', to: '/admin/users', icon: Users, end: false },
  { label: 'Settings', to: '/admin/settings', icon: Settings, end: false },
];

export function AdminLayout({
  title,
  subtitle,
  actionSlot,
  children,
}: AdminLayoutProps) {
  const [alertCounts, setAlertCounts] = useState<AdminAlertCounts>({
    pendingListings: 0,
    pendingVerifications: 0,
    openReports: 0,
  });

  useEffect(() => {
    const unsubscribe = subscribeToAdminAlertCounts((counts) => {
      setAlertCounts(counts);
    });
    return () => unsubscribe();
  }, []);

  const showAlertBanner = hasAnyAdminAlerts(alertCounts);

  const getNavBadgeCount = (to: string): number => {
    if (to === '/admin/listings') return alertCounts.pendingListings;
    if (to === '/admin/verifications') return alertCounts.pendingVerifications;
    if (to === '/admin/reports') return alertCounts.openReports;
    return 0;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-12">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Desktop Sidebar */}
        <aside
          aria-label="Admin Navigation"
          className="hidden lg:block w-60 shrink-0"
        >
          <div className="sticky top-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 px-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-blue-950/60 text-primary-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Admin Console</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">LASUEDPLUG Moderation</p>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const badgeCount = getNavBadgeCount(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-50 dark:bg-blue-950/60 text-primary-700 dark:text-blue-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`
                    }
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {badgeCount > 0 && (
                      <span
                        data-testid={`admin-nav-badge-${item.to.split('/').pop()}`}
                        className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 tabular-nums shrink-0"
                      >
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <Link
                to="/"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Return to Marketplace</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Panel */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Real-time Admin Alert Banner */}
          {showAlertBanner && (
            <div
              role="status"
              data-testid="admin-alert-banner"
              className="rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 shadow-sm flex items-start gap-2.5"
            >
              <AlertTriangle
                className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="leading-relaxed">
                ⚠️ Attention: You have{' '}
                <Link
                  to="/admin/listings"
                  className="font-bold underline decoration-amber-500 underline-offset-2 hover:text-amber-700 dark:hover:text-amber-100"
                >
                  {alertCounts.pendingListings} pending listings
                </Link>
                ,{' '}
                <Link
                  to="/admin/verifications"
                  className="font-bold underline decoration-amber-500 underline-offset-2 hover:text-amber-700 dark:hover:text-amber-100"
                >
                  {alertCounts.pendingVerifications} verifications
                </Link>
                , and{' '}
                <Link
                  to="/admin/reports"
                  className="font-bold underline decoration-amber-500 underline-offset-2 hover:text-amber-700 dark:hover:text-amber-100"
                >
                  {alertCounts.openReports} open reports
                </Link>
                .
              </p>
            </div>
          )}

          {/* Mobile Horizontal Nav Tabs */}
          <nav
            aria-label="Admin Mobile Navigation"
            className="lg:hidden flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1"
          >
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const badgeCount = getNavBadgeCount(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 tabular-nums">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {title}
              </h1>
              {subtitle && <p className="text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
            </div>
            {actionSlot && <div className="shrink-0">{actionSlot}</div>}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
