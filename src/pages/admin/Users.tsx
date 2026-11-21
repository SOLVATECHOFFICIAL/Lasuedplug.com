import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Ban,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  filterAdminUsers,
  getPrimaryUserRoleBadge,
} from '../../lib/adminHelpers';
import { getAllUsers, updateUserAccountStatus } from '../../lib/adminService';
import { getFastCache, setFastCache } from '../../lib/fastCache';
import { UserProfile } from '../../types';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Button } from '../../components/ui/Button';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { ErrorState } from '../../components/feedback/ErrorState';

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCached = getFastCache<UserProfile[]>('admin_users');
  const [users, setUsers] = useState<UserProfile[]>(() => initialCached ?? []);
  const [loading, setLoading] = useState(() => !initialCached);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    const paramQuery = searchParams.get('q') || '';
    if (paramQuery !== searchQuery) {
      setSearchQuery(paramQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      nextParams.set('q', value);
    } else {
      nextParams.delete('q');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const loadUsers = useCallback(async () => {
    const cached = getFastCache<UserProfile[]>('admin_users');
    if (!cached) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await getAllUsers();
      setUsers(data);
      setFastCache('admin_users', data);
    } catch (err) {
      if (!cached) {
        setError(
          err instanceof Error ? err.message : 'Unable to load users list.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(
    () => filterAdminUsers(users, searchQuery),
    [users, searchQuery]
  );

  const handleToggleStatus = async (target: UserProfile) => {
    if (!target.uid || busyUid) return;
    if (target.uid === currentUser?.uid) {
      showToast('You cannot suspend your own admin account.', 'info');
      return;
    }

    const nextStatus: 'active' | 'suspended' =
      target.status === 'suspended' ? 'active' : 'suspended';

    setBusyUid(target.uid);
    try {
      await updateUserAccountStatus(target.uid, nextStatus);
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === target.uid
            ? {
                ...u,
                status: nextStatus,
                ...(nextStatus === 'active' ? { isBanned: false } : {}),
              }
            : u
        )
      );
      showToast(
        nextStatus === 'suspended'
          ? `${target.fullName || target.email} has been suspended and their listings hidden.`
          : `${target.fullName || target.email} is active again.`,
        'info'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to update user status.',
        'error'
      );
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <AdminLayout
      title="Users Management"
      subtitle="View registered campus accounts, roles, and manage reversible account suspensions."
      actionSlot={
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadUsers()}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      }
    >
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load users"
          message={error}
          onRetry={() => void loadUsers()}
        />
      ) : (
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name, email, department, or UID..."
              aria-label="Search users"
              className="block w-full pl-10 pr-9 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                aria-label="Clear user search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {filteredUsers.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              No matching users found.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4">Name</th>
                      <th className="py-3.5 px-4">Email</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredUsers.map((account) => {
                      const isSuspended = account.status === 'suspended';
                      const isBanned = account.isBanned === true;
                      const isSelf = account.uid === currentUser?.uid;
                      const isBusy = busyUid === account.uid;

                      return (
                        <tr key={account.uid} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 inline-flex items-center gap-1.5">
                              <span>{account.fullName || 'Unnamed Student'}</span>
                              {account.isVerified && <VerifiedBadge size="xs" />}
                            </div>
                            {account.department && (
                              <div className="text-xs text-slate-500">
                                {account.department}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {account.email}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              {getPrimaryUserRoleBadge(account)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isSuspended ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  <span>Suspended</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Active</span>
                                </span>
                              )}
                              {isBanned && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900 text-white">
                                  <Ban className="w-3 h-3" />
                                  <span>Banned</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Button
                              variant={isSuspended ? 'outline' : 'danger'}
                              size="sm"
                              disabled={isBusy || isSelf}
                              onClick={() => void handleToggleStatus(account)}
                            >
                              {isBusy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isSuspended ? (
                                <UserCheck className="w-3.5 h-3.5" />
                              ) : (
                                <UserX className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {isSelf
                                  ? 'Current Admin'
                                  : isSuspended
                                  ? 'Unsuspend'
                                  : 'Suspend'}
                              </span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
