import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigationType } from 'react-router-dom';
import { AlertTriangle, Wrench } from 'lucide-react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { MobileNav } from './MobileNav';
import { InstallPWA } from './InstallPWA';
import { useAuth } from '../../contexts/AuthContext';
import { isAuthorizedAdminSession } from '../../lib/adminHelpers';
import {
  buildRouteKey,
  getSavedRouteScroll,
  getScrollActionForNavigation,
  recordInAppRoute,
  saveRouteScroll,
} from '../../lib/feedScrollState';
import { shouldShowMaintenanceScreen } from '../../lib/platformSettingsHelpers';
import { subscribeToPlatformSettings } from '../../lib/platformSettingsService';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, loading, isProfileComplete, isSuspended } = useAuth();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const prevPathnameRef = useRef<string>(location.pathname);
  const currentLocationRef = useRef({
    key: location.key,
    routeKey: buildRouteKey(location.pathname, location.search),
  });
  const isRestoringScrollRef = useRef(false);

  currentLocationRef.current = {
    key: location.key,
    routeKey: buildRouteKey(location.pathname, location.search),
  };

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'scrollRestoration' in window.history
    ) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToPlatformSettings((settings) => {
      setMaintenanceMode(settings.maintenanceMode);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafId: number | null = null;

    const handleScroll = () => {
      if (isRestoringScrollRef.current) return;
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        if (isRestoringScrollRef.current) return;
        const { key, routeKey } = currentLocationRef.current;
        saveRouteScroll(key, routeKey, window.scrollY);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const routeKey = buildRouteKey(location.pathname, location.search);
    recordInAppRoute(routeKey, navigationType);

    const pathnameChanged = prevPathnameRef.current !== location.pathname;
    prevPathnameRef.current = location.pathname;

    const action = getScrollActionForNavigation({
      navigationType,
      pathnameChanged,
    });

    if (action === 'none') {
      return;
    }

    if (action === 'reset-top') {
      isRestoringScrollRef.current = false;
      window.scrollTo(0, 0);
      const raf = window.requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
      return () => window.cancelAnimationFrame(raf);
    }

    const savedY = getSavedRouteScroll(location.key, routeKey);

    if (typeof savedY !== 'number' || savedY <= 0) {
      isRestoringScrollRef.current = false;
      window.scrollTo(0, 0);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let rafId: number | null = null;
    isRestoringScrollRef.current = true;

    const cancelRestoreOnUserInput = () => {
      cancelled = true;
      isRestoringScrollRef.current = false;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    window.addEventListener('wheel', cancelRestoreOnUserInput, { passive: true, once: true });
    window.addEventListener('touchstart', cancelRestoreOnUserInput, { passive: true, once: true });

    const tryRestore = () => {
      if (cancelled) return;
      window.scrollTo(0, savedY);
      const maxReachableY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const settled =
        Math.abs(window.scrollY - savedY) <= 4 && maxReachableY >= savedY - 4;
      attempts += 1;

      if (settled || attempts >= 24) {
        isRestoringScrollRef.current = false;
        window.removeEventListener('wheel', cancelRestoreOnUserInput);
        window.removeEventListener('touchstart', cancelRestoreOnUserInput);
        return;
      }

      rafId = window.requestAnimationFrame(tryRestore);
    };

    tryRestore();

    return () => {
      cancelled = true;
      isRestoringScrollRef.current = false;
      window.removeEventListener('wheel', cancelRestoreOnUserInput);
      window.removeEventListener('touchstart', cancelRestoreOnUserInput);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [location.key, location.pathname, location.search, navigationType]);

  const handleCaptureScrollBeforeNavigation = () => {
    if (typeof window === 'undefined') return;
    const { key, routeKey } = currentLocationRef.current;
    saveRouteScroll(key, routeKey, window.scrollY);
  };

  const isAdminSession = isAuthorizedAdminSession(user);
  const showMaintenanceGate = shouldShowMaintenanceScreen({
    maintenanceMode,
    pathname: location.pathname,
    user,
  });

  if (showMaintenanceGate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-4 py-12 font-sans antialiased">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Wrench className="w-7 h-7" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                We&apos;ll be right back
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                LASUEDPLUG is currently undergoing scheduled maintenance and updates to
                keep the campus marketplace fast and secure. Please check back shortly.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <Link
                to="/login"
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-blue-400 transition-colors"
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
    <div
      onClickCapture={handleCaptureScrollBeforeNavigation}
      className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased overflow-x-clip"
    >
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
            className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 text-center text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-200"
          >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Complete your profile to start buying and selling.{' '}
                <Link
                  to="/dashboard/profile"
                  className="font-semibold underline underline-offset-2 text-amber-950 dark:text-amber-100 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-200"
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
