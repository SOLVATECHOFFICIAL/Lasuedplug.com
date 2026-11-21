import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  CheckCheck,
  CheckCircle2,
  MessageCircle,
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
import { getFastCache, setFastCache } from '../../lib/fastCache';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AppNotification } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/feedback/Loading';
import { ErrorState } from '../../components/feedback/ErrorState';

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
  const { user } = useAuth();
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-slate-600">
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

      {/* Filter Tabs */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
            filter === 'unread'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
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
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
            <Bell className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">
              {filter === 'unread' ? 'You are all caught up!' : 'No notifications yet'}
            </h2>
            <p className="text-sm text-slate-500">
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
                  ? 'bg-white border-slate-200 hover:bg-slate-50'
                  : 'bg-blue-50/60 border-blue-200 hover:bg-blue-50 shadow-sm'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0">
                <NotificationIcon type={item.type} />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-500">
                      {formatNotificationTime(item.createdAt)}
                    </span>
                    {!item.isRead && (
                      <span
                        aria-label="Unread"
                        className="w-2 h-2 rounded-full bg-blue-600"
                      />
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
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
