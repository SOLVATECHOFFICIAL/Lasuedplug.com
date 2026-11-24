import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Bell,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  Flag,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  getUserNotifications,
  markAllAsRead,
  markAsRead,
} from '../../lib/notificationService';
import {
  countUnreadNotifications,
  formatNotificationTime,
} from '../../lib/notificationHelpers';
import {
  AdminAlertCounts,
  buildAdminBellAlerts,
  getAdminAlertTotal,
  isAuthorizedAdminSession,
  isUserAdmin,
} from '../../lib/adminHelpers';
import { subscribeToAdminAlertCounts } from '../../lib/adminService';
import { getFastCache, setFastCache } from '../../lib/fastCache';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AppNotification } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/feedback/Loading';
import { ErrorState } from '../../components/feedback/ErrorState';
import { SeoHead } from '../../components/seo/SeoHead';

function NotificationIcon({ type }: { type: AppNotification['type'] }) {
  switch (type) {
    case 'listing_approved':
      return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
    case 'listing_rejected':
      return <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />;
    case 'enquiry_received':
      return <MessageCircle className="w-5 h-5 text-blue-600 shrink-0" />;
    case 'system':
    default:
      return <Sparkles className="w-5 h-5 text-primary-600 shrink-0" />;
  }
}

export function NotificationsIndex() {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const initialCached = user?.uid
    ? getFastCache<AppNotification[]>(`notifications:${user.uid}`)
    : null;
  const [notifications, setNotifications] = useState<AppNotification[]>(
    () => initialCached ?? []
  );
  const [loading, setLoading] = useState(() => Boolean(user?.uid) && !initialCached);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [adminAlertCounts, setAdminAlertCounts] = useState<AdminAlertCounts>({
    pendingListings: 0,
    pendingVerifications: 0,
    openReports: 0,
  });

  const isAdminBellActive =
    isAuthorizedAdminSession(user) || isUserAdmin(profile);
  const adminAlertTotal = isAdminBellActive
    ? getAdminAlertTotal(adminAlertCounts)
    : 0;
  const adminBellAlerts = useMemo(
    () => (isAdminBellActive ? buildAdminBellAlerts(adminAlertCounts) : []),
    [isAdminBellActive, adminAlertCounts]
  );

  useEffect(() => {
    if (!isAdminBellActive) {
      setAdminAlertCounts({
        pendingListings: 0,
        pendingVerifications: 0,
        openReports: 0,
      });
      return;
    }
    const unsubscribe = subscribeToAdminAlertCounts(
      (counts) => setAdminAlertCounts(counts),
      () => {
        // Silent fallback
      }
    );
    return () => unsubscribe();
  }, [isAdminBellActive]);

  const loadNotifications = useCallback(async () => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const cached = getFastCache<AppNotification[]>(`notifications:${user.uid}`);
    if (cached) {
      setNotifications(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const items = await getUserNotifications(user.uid, 50);
      setNotifications(items);
      setFastCache(`notifications:${user.uid}`, items);
    } catch (err) {
      if (!cached) {
        const msg =
          err instanceof Error ? err.message : 'Unable to load notifications.';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(
    () => countUnreadNotifications(notifications),
    [notifications]
  );

  const visibleNotifications = useMemo(
    () =>
      filter === 'unread'
        ? notifications.filter((n) => !n.isRead)
        : notifications,
    [notifications, filter]
  );

  const handleNotificationClick = async (item: AppNotification) => {
    if (item.id && !item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      try {
        await markAsRead(item.id);
      } catch {
        // Non-blocking fallback
      }
    }
    if (item.link) {
      navigate(item.link);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications
      .filter((n) => !n.isRead && Boolean(n.id))
      .map((n) => n.id as string);
    if (unreadIds.length === 0 || markingAll) return;

    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      await markAllAsRead(unreadIds);
      showToast('All notifications marked as read.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to update notifications.',
        'error'
      );
      void loadNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-12 space-y-6">
      <SeoHead
        title="Notifications"
        description="Stay updated on listing approvals, buyer WhatsApp enquiries, and account alerts on LASUEDPLUG."
        noIndex
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Stay updated on listing approvals, buyer WhatsApp enquiries, and account alerts.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={markingAll}
            onClick={() => void handleMarkAllRead()}
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark all as read ({unreadCount})</span>
          </Button>
        )}
      </div>

      {/* Admin-only Moderation Queue (invisible to regular users) */}
      {isAdminBellActive && (
        <section
          aria-label="Admin Moderation Queue"
          data-testid="admin-notifications-queue"
          className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 p-4 sm:p-5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-amber-950 dark:text-amber-100">
                  Admin Moderation Queue
                </h2>
                <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                  Live pending items visible only to your admin account.
                </p>
              </div>
            </div>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary-700 dark:text-primary-400 hover:underline"
            >
              <span>Open Admin Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {adminAlertTotal === 0 ? (
            <p className="text-xs font-medium text-amber-900/80 dark:text-amber-200/90 bg-white/80 dark:bg-slate-900/80 border border-amber-200/70 dark:border-amber-800/60 rounded-xl px-3.5 py-2.5">
              All clear — no pending listings, verification requests, or open reports.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {adminBellAlerts.map((alert) => {
                const Icon =
                  alert.id === 'verifications'
                    ? BadgeCheck
                    : alert.id === 'reports'
                    ? Flag
                    : CheckSquare;
                return (
                  <Link
                    key={alert.id}
                    to={alert.to}
                    className="flex items-center justify-between gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/70 hover:border-primary-300 dark:hover:border-primary-600 shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {alert.title}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                          {alert.subtitle}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 tabular-nums shrink-0">
                      {alert.count}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Filter Tabs */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
            filter === 'unread'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {loading ? (
        <Loading variant="skeleton" message="Loading notifications..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadNotifications()} />
      ) : visibleNotifications.length === 0 ? (
        <Card hoverable={false} className="border-dashed text-center py-12 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center">
            <Bell className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {filter === 'unread' ? 'You are all caught up!' : 'No notifications yet'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filter === 'unread'
                ? 'You have no unread notifications right now.'
                : 'Listing approval updates and buyer WhatsApp enquiries will appear here.'}
            </p>
          </div>
          {filter === 'unread' && notifications.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilter('all')}
            >
              Show All Notifications
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2.5">
          {visibleNotifications.map((item) => (
            <button
              key={item.id || `${item.title}-${item.message}`}
              type="button"
              onClick={() => void handleNotificationClick(item)}
              className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                item.isRead
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                  : 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/70 hover:bg-blue-50 dark:hover:bg-blue-950/50 shadow-sm'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <NotificationIcon type={item.type} />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatNotificationTime(item.createdAt)}
                    </span>
                    {!item.isRead && (
                      <span
                        aria-label="Unread"
                        className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400"
                      />
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {item.message}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
