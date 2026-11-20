import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Store,
  User as UserIcon,
  X,
} from 'lucide-react';
import { LOGO_URL, SITE_NAME } from '../../lib/constants';
import { getInitials } from '../../lib/authHelpers';
import {
  countUnreadNotifications,
  formatNotificationTime,
} from '../../lib/notificationHelpers';
import {
  markAllAsRead,
  markAsRead,
  subscribeToUserNotifications,
} from '../../lib/notificationService';
import { isAuthorizedAdminEmail } from '../../lib/adminHelpers';
import { AppNotification } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();
  const { showToast } = useToast();

  const displayName = profile?.fullName || user?.displayName || 'Campus User';
  const initials = getInitials(
    profile?.fullName || user?.displayName,
    user?.email
  );
  const unreadCount = useMemo(
    () => countUnreadNotifications(notifications),
    [notifications]
  );

  useEffect(() => {
    setDropdownOpen(false);
    setNotifDropdownOpen(false);
    setMobileMenuOpen(false);
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
    <header className="sticky top-0 z-50 bg-white">
      <OfflineBanner />
      <div className="border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-3.5 sm:px-6 h-14 md:h-16 gap-2">
          {/* Left: Logo + Wordmark */}
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0 group transition-all duration-200">
            <img
              src={LOGO_URL}
              alt={SITE_NAME}
              className="h-8 md:h-10 w-auto object-contain shrink-0"
            />
            <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors duration-200 truncate">
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
                      ? 'text-blue-600 border-blue-600'
                      : 'text-slate-600 border-transparent hover:text-blue-600'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Right Auth / Account */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            {loading ? (
              <div className="h-9 w-24 rounded-lg bg-slate-100 animate-pulse" />
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
                      unreadCount > 0
                        ? `Notifications (${unreadCount} unread)`
                        : 'Notifications'
                    }
                    aria-expanded={notifDropdownOpen}
                    aria-haspopup="menu"
                    className="relative p-2 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span
                        data-testid="unread-notification-badge"
                        className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-sm"
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifDropdownOpen && (
                    <div
                      role="menu"
                      aria-label="Recent Notifications"
                      className="absolute right-0 mt-2 w-80 rounded-xl bg-white border border-slate-200 shadow-lg py-2 z-50"
                    >
                      <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          Notifications
                        </span>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={() => void handleMarkAllRead()}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Mark all read</span>
                          </button>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs text-slate-500">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.slice(0, 6).map((item) => (
                            <button
                              key={item.id || `${item.title}-${item.message}`}
                              type="button"
                              role="menuitem"
                              onClick={() => void handleNotificationItemClick(item)}
                              className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-2.5 ${
                                !item.isRead ? 'bg-blue-50/50' : ''
                              }`}
                            >
                              <span
                                className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                                  item.isRead ? 'bg-transparent' : 'bg-blue-600'
                                }`}
                              />
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-slate-900 truncate">
                                    {item.title}
                                  </p>
                                  <span className="text-[11px] text-slate-400 shrink-0">
                                    {formatNotificationTime(item.createdAt)}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 line-clamp-2">
                                  {item.message}
                                </p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>

                      <div className="border-t border-slate-100 pt-1.5 px-3">
                        <Link
                          to="/notifications"
                          onClick={() => setNotifDropdownOpen(false)}
                          className="block w-full text-center py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 rounded-lg hover:bg-slate-50 transition-colors"
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
                    className="flex items-center gap-2 p-1 pr-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                  {profile?.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={displayName}
                      loading="lazy"
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center">
                      {initials}
                    </span>
                  )}
                  <span className="text-sm font-medium text-slate-700 max-w-[120px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {dropdownOpen && (
                  <div
                    role="menu"
                    aria-label="User account options"
                    className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-md py-1.5 z-50"
                  >
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {user.email}
                      </p>
                    </div>

                    <Link
                      to="/dashboard/profile"
                      role="menuitem"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                    >
                      <UserIcon className="w-4 h-4" />
                      <span>My Profile</span>
                    </Link>

                    <Link
                      to="/dashboard/seller"
                      role="menuitem"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                    >
                      <Store className="w-4 h-4" />
                      <span>Seller Dashboard</span>
                    </Link>

                    <Link
                      to="/dashboard/buyer"
                      role="menuitem"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span>My Dashboard</span>
                    </Link>

                    {isAuthorizedAdminEmail(user?.email) && (
                      <Link
                        to="/admin"
                        role="menuitem"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50 transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Admin Console</span>
                      </Link>
                    )}

                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void handleLogout()}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
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
            {!loading && user && (
              <>
                <Link
                  to="/notifications"
                  aria-label={
                    unreadCount > 0
                      ? `Notifications (${unreadCount} unread)`
                      : 'Notifications'
                  }
                  className="relative w-11 h-11 rounded-full border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50 transition-all duration-200 active:scale-95"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
                <Link
                  to="/dashboard/profile"
                  aria-label="Go to profile"
                  className="w-10 h-10 rounded-full bg-primary-500 text-white text-xs font-bold flex items-center justify-center overflow-hidden transition-all duration-200 active:scale-95"
                >
                  {profile?.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={displayName}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="min-h-[48px] min-w-[48px] -mr-2 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-all duration-200 active:scale-95"
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
          className="md:hidden fixed inset-0 z-50 bg-white flex flex-col justify-between p-6 overflow-y-auto"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5"
              >
                <img
                  src={LOGO_URL}
                  alt={SITE_NAME}
                  className="h-10 w-auto object-contain"
                />
                <span className="font-extrabold text-lg text-slate-900 tracking-tight">
                  {SITE_NAME}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors duration-200"
                aria-label="Close menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {user && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="w-10 h-10 rounded-full bg-primary-500 text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
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
                        ? 'text-blue-600 bg-primary-50 font-semibold'
                        : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-6 border-t border-slate-200 flex flex-col gap-3">
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
                  onClick={() => handleMobileNav('/dashboard/buyer')}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  My Dashboard
                </Button>
                {isAuthorizedAdminEmail(user?.email) && (
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
