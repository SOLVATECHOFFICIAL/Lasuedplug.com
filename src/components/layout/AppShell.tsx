import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, Wrench } from 'lucide-react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { MobileNav } from './MobileNav';
import { InstallPWA } from './InstallPWA';
import { useAuth } from '../../contexts/AuthContext';
import { isAuthorizedAdminSession } from '../../lib/adminHelpers';
import { shouldShowMaintenanceScreen } from '../../lib/platformSettingsHelpers';
import { subscribeToPlatformSettings } from '../../lib/platformSettingsService';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, loading, isProfileComplete, isSuspended } = useAuth();
  const location = useLocation();
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPlatformSettings((settings) => {
      setMaintenanceMode(settings.maintenanceMode);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [location.pathname, location.search]);

  const isAdminSession = isAuthorizedAdminSession(user);
  const showMaintenanceGate = shouldShowMaintenanceScreen({
    maintenanceMode,
    pathname: location.pathname,
    user,
  });

  if (showMaintenanceGate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 px-4 py-12 font-sans antialiased">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Wrench className="w-7 h-7" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                We&apos;ll be right back
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                LASUEDPLUG is currently undergoing scheduled maintenance and updates to
                keep the campus marketplace fast and secure. Please check back shortly.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <Link
                to="/login"
                className="text-xs font-semibold text-slate-500 hover:text-primary-600 transition-colors"
              >
                Admin Sign In
              </Link>
            </div>
          </div>
        </div>
    );
  }

  const showIncompleteBanner =
    !loading && Boolean(user) && !isSuspended && !isProfileComplete;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased overflow-x-clip">
      <Navbar />
        {maintenanceMode && isAdminSession && (
          <div
            role="status"
            className="bg-amber-600 text-white px-4 py-2 text-center text-xs sm:text-sm font-medium"
          >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2">
              <Wrench className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                Maintenance Mode is active — public users see the maintenance screen.{' '}
                <Link
                  to="/admin/settings"
                  className="font-bold underline underline-offset-2 hover:text-amber-100"
                >
                  Manage in Settings
                </Link>
              </span>
            </div>
          </div>
        )}
        {showIncompleteBanner && (
          <div
            role="alert"
            className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center text-xs sm:text-sm font-medium text-amber-900"
          >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Complete your profile to start buying and selling.{' '}
                <Link
                  to="/dashboard/profile"
                  className="font-semibold underline underline-offset-2 text-amber-950 hover:text-blue-700 transition-all duration-200"
                >
                  Go to Profile.
                </Link>
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 w-full pb-20 md:pb-0">{children}</main>
        <Footer />
        <InstallPWA />
        <MobileNav />
    </div>
  );
}
