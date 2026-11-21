import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  Download,
  Flag,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Store,
  Sun,
  User as UserIcon,
  X,
} from 'lucide-react';
import { LOGO_URL, SITE_NAME } from '../../lib/constants';
import { getUserAvatarUrl } from '../../lib/authHelpers';
import {
  DASHBOARD_MODE_EVENT,
  getPreferredDashboardPath,
} from '../../lib/dashboardMode';
import {
  countUnreadNotifications,
  formatNotificationTime,
} from '../../lib/notificationHelpers';
import {
  markAllAsRead,
  markAsRead,
  subscribeToUserNotifications,
} from '../../lib/notificationService';
import {
  AdminAlertCounts,
  buildAdminBellAlerts,
  getAdminAlertTotal,
  isAuthorizedAdminEmail,
  isAuthorizedAdminSession,
  isUserAdmin,
} from '../../lib/adminHelpers';
import { subscribeToAdminAlertCounts } from '../../lib/adminService';
import { AppNotification } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { usePWAInstall } from '../../contexts/PWAContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { UserAvatar } from '../ui/UserAvatar';
import { OfflineBanner } from './OfflineBanner';

const NAV_LINKS = [
  { name: 'Marketplace', path: '/marketplace' },
  { name: 'Services', path: '/services' },
  { name: 'Accommodation', path: '/accommodation' },
  { name: 'Roommates', path: '/roommates' },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [adminAlertCounts, setAdminAlertCounts] = useState<AdminAlertCounts>({
    pendingListings: 0,
    pendingVerifications: 0,
    openReports: 0,
  });
  const [preferredDashboardPath, setPreferredDashboardPath] = useState<
    '/dashboard/buyer' | '/dashboard/seller'
  >(() => getPreferredDashboardPath());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const adminAlertsInitializedRef = useRef(false);
  const prevAdminTotalRef = useRef(0);

  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();
  const { canInstall, installing: pwaInstalling, install: installPwa } =
    usePWAInstall();
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const displayName = profile?.fullName || user?.displayName || 'Campus User';
  const avatarSrc = getUserAvatarUrl(profile);
  const showAdminConsoleLink =
    isAuthorizedAdminEmail(user?.email) || isUserAdmin(profile);
  const isAdminBellActive =
    isAuthorizedAdminSession(user) || isUserAdmin(profile);
  const unreadCount = useMemo(
    () => countUnreadNotifications(notifications),
    [notifications]
  );
  const adminAlertTotal = isAdminBellActive
    ? getAdminAlertTotal(adminAlertCounts)
    : 0;
  const adminBellAlerts = useMemo(
    () => (isAdminBellActive ? buildAdminBellAlerts(adminAlertCounts) : []),
    [isAdminBellActive, adminAlertCounts]
  );
  const totalBadgeCount = unreadCount + adminAlertTotal;

  useEffect(() => {
    setDropdownOpen(false);
    setNotifDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const syncPreferredPath = () => {
      setPreferredDashboardPath(getPreferredDashboardPath());
    };
    syncPreferredPath();
    window.addEventListener(DASHBOARD_MODE_EVENT, syncPreferredPath);
    window.addEventListener('storage', syncPreferredPath);
    return () => {
      window.removeEventListener(DASHBOARD_MODE_EVENT, syncPreferredPath);
      window.removeEventListener('storage', syncPreferredPath);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      return;
    }
    const unsubscribe = subscribeToUserNotifications(
      user.uid,
      (items) => setNotifications(items),
      () => {
        // Silent background fallback if offline
      }
    );
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!isAdminBellActive) {
      adminAlertsInitializedRef.current = false;
      prevAdminTotalRef.current = 0;
      setAdminAlertCounts({
        pendingListings: 0,
        pendingVerifications: 0,
        openReports: 0,
      });
      return;
    }

    const unsubscribe = subscribeToAdminAlertCounts(
      (counts) => {
        setAdminAlertCounts(counts);
        const nextTotal = getAdminAlertTotal(counts);
        if (
          adminAlertsInitializedRef.current &&
          nextTotal > prevAdminTotalRef.current &&
          !pathnameRef.current.startsWith('/admin')
        ) {
          showToast(
            `Admin moderation alert: ${counts.pendingListings} pending listings, ${counts.pendingVerifications} verifications, ${counts.openReports} open reports.`,
            'info'
          );
        }
        adminAlertsInitializedRef.current = true;
        prevAdminTotalRef.current = nextTotal;
      },
      () => {
        // Silent fallback when offline
      }
    );

    return () => unsubscribe();
  }, [isAdminBellActive, showToast]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setDropdownOpen(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(target)) {
        setNotifDropdownOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        setNotifDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleNotificationItemClick = async (item: AppNotification) => {
    setNotifDropdownOpen(false);
    if (item.id && !item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      try {
        await markAsRead(item.id);
      } catch {
        // Non-blocking
      }
    }
    navigate(item.link || '/notifications');
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications
      .filter((n) => !n.isRead && Boolean(n.id))
      .map((n) => n.id as string);
    if (unreadIds.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllAsRead(unreadIds);
    } catch {
      // Non-blocking
    }
  };

  const handleMobileNav = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    try {
      await signOut();
      showToast('Signed out successfully.', 'info');
      navigate('/');
    } catch {
      showToast('Unable to sign out. Please try again.', 'error');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-slate-900">
      <OfflineBanner />
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-3.5 sm:px-6 h-14 md:h-16 gap-2">
          {/* Left: Logo + Wordmark */}
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0 group transition-all duration-200">
            <img
              src={LOGO_URL}
              alt={SITE_NAME}
              loading="lazy"
              decoding="async"
              className="h-8 md:h-10 w-auto object-contain shrink-0"
            />
            <span className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200 truncate">
              {SITE_NAME}
            </span>
          </Link>

          {/* Desktop Center Links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-6"
          >
            {NAV_LINKS.map((link) => {
              const isActive =
                link.path === '/roommates'
                  ? location.pathname === '/roommates' ||
                    location.pathname === '/accommodation/roommates'
                  : location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-sm font-medium transition-all duration-200 py-1 border-b-2 ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                      : 'text-slate-600 dark:text-slate-300 border-transparent hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Right Auth / Account */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Light mode' : 'Dark mode'}
              data-testid="theme-toggle-desktop"
              className="p-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-amber-300 hover:text-slate-900 dark:hover:text-amber-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {canInstall && (
              <Button
                variant="outline"
                size="sm"
                disabled={pwaInstalling}
                onClick={() => void installPwa()}
                aria-label="Install App"
                data-testid="navbar-install-app-desktop"
              >
                <Download className="w-4 h-4 text-primary-600 dark:text-blue-400" />
                <span>Install App</span>
              </Button>
            )}
            {loading ? (
              <div className="h-9 w-24 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2">
                {/* Notification Bell Dropdown */}
                <div className="relative" ref={notifDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifDropdownOpen((prev) => !prev);
                      setDropdownOpen(false);
                    }}
                    aria-label={
                      totalBadgeCount > 0
                        ? `Notifications (${totalBadgeCount} unread)`
                        : 'Notifications'
                    }
                    aria-expanded={notifDropdownOpen}
                    aria-haspopup="menu"
                    className="relative p-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <Bell className="w-5 h-5" />
                    {totalBadgeCount > 0 && (
                      <span
                        data-testid="unread-notification-badge"
                        className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-sm"
                      >
                        {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
                      </span>
                    )}
                  </button>

                  {notifDropdownOpen && (
                    <div
                      role="menu"
                      aria-label="Recent Notifications"
                      className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg py-2 z-50"
                    >
                      {isAdminBellActive && (
                        <div
                          data-testid="admin-bell-queue"
                          className="mx-2 mb-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 overflow-hidden"
                        >
                          <div className="px-3 py-2 border-b border-amber-200/70 dark:border-amber-800/70 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                              <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                                Admin Moderation Queue
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700 tabular-nums">
                              {adminAlertTotal > 0 ? `${adminAlertTotal} pending` : 'All clear'}
                            </span>
                          </div>

                          {adminBellAlerts.length === 0 ? (
                            <div className="px-3 py-2.5 flex items-center justify-between gap-2 text-xs text-amber-900/80 dark:text-amber-200">
                              <span>No pending approvals or reports.</span>
                              <Link
                                to="/admin"
                                role="menuitem"
                                onClick={() => setNotifDropdownOpen(false)}
                                className="font-semibold text-primary-700 dark:text-blue-400 hover:underline whitespace-nowrap"
                              >
                                Dashboard →
                              </Link>
                            </div>
                          ) : (
                            <div className="divide-y divide-amber-200/60 dark:divide-amber-800/60">
                              {adminBellAlerts.map((alert) => {
                                const AlertIcon =
                                  alert.id === 'verifications'
                                    ? BadgeCheck
                                    : alert.id === 'reports'
                                    ? Flag
                                    : CheckSquare;
                                const badgeClass =
                                  alert.tone === 'red'
                                    ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                                    : alert.tone === 'indigo'
                                    ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700';
                                return (
                                  <button
                                    key={alert.id}
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setNotifDropdownOpen(false);
                                      navigate(alert.to);
                                    }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors flex items-center justify-between gap-2.5"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <AlertIcon className="w-4 h-4 text-amber-800 dark:text-amber-300 shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                          {alert.title}
                                        </p>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                                          {alert.subtitle}
                                        </p>
                                      </div>
                                    </div>
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold border tabular-nums shrink-0 ${badgeClass}`}
                                    >
                                      {alert.count}
                                    </span>
                                  </button>
                                );
                              })}
                              <div className="px-3 py-1.5 bg-amber-100/40 dark:bg-amber-950/60 flex justify-end">
                                <Link
                                  to="/admin"
                                  role="menuitem"
                                  onClick={() => setNotifDropdownOpen(false)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-700 dark:text-blue-400 hover:underline"
                                >
                                  <span>Open Admin Console</span>
                                  <ArrowRight className="w-3 h-3" />
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          Notifications
                        </span>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={() => void handleMarkAllRead()}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Mark all read</span>
                          </button>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.slice(0, 6).map((item) => (
                            <button
                              key={item.id || `${item.title}-${item.message}`}
                              type="button"
                              role="menuitem"
                              onClick={() => void handleNotificationItemClick(item)}
                              className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors flex items-start gap-2.5 ${
                                !item.isRead ? 'bg-blue-50/50 dark:bg-blue-950/30' : ''
                              }`}
                            >
                              <span
                                className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                                  item.isRead ? 'bg-transparent' : 'bg-blue-600 dark:bg-blue-400'
                                }`}
                              />
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                    {item.title}
                                  </p>
                                  <span className="text-[11px] text-slate-400 shrink-0">
                                    {formatNotificationTime(item.createdAt)}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                                  {item.message}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 px-3">
                        <Link
                          to="/notifications"
                          onClick={() => setNotifDropdownOpen(false)}
                          className="block w-full text-center py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          View all notifications
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen((prev) => !prev);
                      setNotifDropdownOpen(false);
                    }}
                    aria-label="Account menu"
                    aria-expanded={dropdownOpen}
                    aria-haspopup="menu"
                    className="flex items-center gap-2 p-1 pr-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                  <UserAvatar
                    uid={user.uid}
                    src={avatarSrc}
                    name={displayName}
                    email={user.email}
                    size="sm"
                    className="border-0"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {dropdownOpen && (
                  <div
                    role="menu"
                    aria-label="User account options"
                    className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-md py-1.5 z-50"
                  >
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {user.email}
                      </p>
                    </div>

                    <Link
                      to="/dashboard/profile"
                      role="menuitem"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <UserIcon className="w-4 h-4" />
                      <span>My Profile</span>
                    </Link>

                    <Link
                      to="/dashboard/seller"
                      role="menuitem"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <Store className="w-4 h-4" />
                      <span>Seller Dashboard</span>
                    </Link>

                    <Link
                      to={preferredDashboardPath}
                      role="menuitem"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span>My Dashboard</span>
                    </Link>

                    <Link
                      to="/suggestions"
                      role="menuitem"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <Lightbulb className="w-4 h-4" />
                      <span>Suggestions &amp; Updates</span>
                    </Link>

                    {showAdminConsoleLink && (
                      <Link
                        to="/admin"
                        role="menuitem"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-primary-700 dark:text-blue-400 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Admin Console</span>
                      </Link>
                    )}

                    <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void handleLogout()}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
                </div>
              </div>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/login')}
                >
                  Login
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/signup')}
                >
                  Signup
                </Button>
              </>
            )}
          </div>

          {/* Mobile Right Controls */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Light mode' : 'Dark mode'}
              data-testid="theme-toggle-mobile"
              className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-amber-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 active:scale-95 shrink-0"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {canInstall && (
              <button
                type="button"
                disabled={pwaInstalling}
                onClick={() => void installPwa()}
                aria-label="Install App"
                data-testid="navbar-install-app-mobile"
                className="inline-flex items-center gap-1 min-h-[40px] px-2.5 py-1.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-60 shrink-0"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Install<span className="hidden min-[400px]:inline"> App</span>
                </span>
              </button>
            )}
            {!loading && user && (
              <>
                <Link
                  to="/notifications"
                  aria-label={
                    totalBadgeCount > 0
                      ? `Notifications (${totalBadgeCount} unread)`
                      : 'Notifications'
                  }
                  className="relative w-11 h-11 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 active:scale-95"
                >
                  <Bell className="w-4 h-4" />
                  {totalBadgeCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
                    </span>
                  )}
                </Link>
                <Link
                  to="/dashboard/profile"
                  aria-label="Go to profile"
                  className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden transition-all duration-200 active:scale-95 shrink-0"
                >
                  <UserAvatar
                    uid={user.uid}
                    src={avatarSrc}
                    name={displayName}
                    email={user.email}
                    size="md"
                    className="w-full h-full border-0"
                  />
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="min-h-[48px] min-w-[48px] -mr-2 flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 active:scale-95"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Full-Screen Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
          className="md:hidden fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col justify-between p-6 overflow-y-auto"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5"
              >
                <img
                  src={LOGO_URL}
                  alt={SITE_NAME}
                  loading="lazy"
                  decoding="async"
                  className="h-10 w-auto object-contain"
                />
                <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">
                  {SITE_NAME}
                </span>
              </Link>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="p-2 rounded-lg text-slate-700 dark:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200"
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200"
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {user && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <UserAvatar
                  uid={user.uid}
                  src={avatarSrc}
                  name={displayName}
                  email={user.email}
                  size="md"
                  className="border-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                </div>
              </div>
            )}

            <nav
              aria-label="Mobile Fullscreen Navigation"
              className="flex flex-col gap-2"
            >
              {NAV_LINKS.map((link) => {
                const isActive = location.pathname.startsWith(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3.5 rounded-xl text-base font-medium transition-colors duration-200 ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400 bg-primary-50 dark:bg-blue-950/60 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
              <Link
                to="/suggestions"
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 py-3.5 rounded-xl text-base font-medium transition-colors duration-200 flex items-center gap-2.5 ${
                  location.pathname === '/suggestions'
                    ? 'text-blue-600 dark:text-blue-400 bg-primary-50 dark:bg-blue-950/60 font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Lightbulb className="w-4 h-4 shrink-0" />
                <span>Suggestions &amp; Updates</span>
              </Link>
            </nav>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-3">
            {canInstall && (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={pwaInstalling}
                onClick={() => {
                  setMobileMenuOpen(false);
                  void installPwa();
                }}
              >
                <Download className="w-4 h-4" />
                Install App
              </Button>
            )}
            {user ? (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  fullWidth
                  onClick={() => handleMobileNav('/dashboard/profile')}
                >
                  <UserIcon className="w-4 h-4" />
                  My Profile
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={() => handleMobileNav('/dashboard/seller')}
                >
                  <Store className="w-4 h-4" />
                  Seller Dashboard
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={() => handleMobileNav(preferredDashboardPath)}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  My Dashboard
                </Button>
                {showAdminConsoleLink && (
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={() => handleMobileNav('/admin')}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Admin Console
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="lg"
                  fullWidth
                  onClick={() => void handleLogout()}
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  fullWidth
                  onClick={() => handleMobileNav('/login')}
                >
                  Login
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => handleMobileNav('/signup')}
                >
                  Signup
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
