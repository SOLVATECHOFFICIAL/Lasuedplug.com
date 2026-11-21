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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-12">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Desktop Sidebar */}
        <aside
          aria-label="Admin Navigation"
          className="hidden lg:block w-60 shrink-0"
        >
          <div className="sticky top-24 bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 px-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Admin Console</p>
                <p className="text-[11px] text-slate-500">LASUEDPLUG Moderation</p>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-slate-100">
              <Link
                to="/"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
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
              className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-950 shadow-sm flex items-start gap-2.5"
            >
              <AlertTriangle
                className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="leading-relaxed">
                ⚠️ Attention: You have{' '}
                <Link
                  to="/admin/listings"
                  className="font-bold underline decoration-amber-500 underline-offset-2 hover:text-amber-700"
                >
                  {alertCounts.pendingListings} pending listings
                </Link>
                ,{' '}
                <Link
                  to="/admin/verifications"
                  className="font-bold underline decoration-amber-500 underline-offset-2 hover:text-amber-700"
                >
                  {alertCounts.pendingVerifications} verifications
                </Link>
                , and{' '}
                <Link
                  to="/admin/reports"
                  className="font-bold underline decoration-amber-500 underline-offset-2 hover:text-amber-700"
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
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {title}
              </h1>
              {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
            </div>
            {actionSlot && <div className="shrink-0">{actionSlot}</div>}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
