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
  AdminAccountTypeFilter,
  filterAdminUsers,
  getPrimaryUserRoleBadge,
} from '../../lib/adminHelpers';
import { getUserAvatarUrl } from '../../lib/authHelpers';
import { getVerifiedBadgeLabel } from '../../lib/verificationHelpers';
import { getAllUsers, updateUserAccountStatus } from '../../lib/adminService';
import { getFastCache, setFastCache } from '../../lib/fastCache';
import { UserProfile } from '../../types';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Button } from '../../components/ui/Button';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
import { ErrorState } from '../../components/feedback/ErrorState';

function parseAccountFilterParam(raw: string | null): AdminAccountTypeFilter {
  if (raw === 'business' || raw === 'student') return raw;
  return 'all';
}

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCached = getFastCache<UserProfile[]>('admin_users');
  const [users, setUsers] = useState<UserProfile[]>(() => initialCached ?? []);
  const [loading, setLoading] = useState(() => !initialCached);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [accountTypeFilter, setAccountTypeFilter] =
    useState<AdminAccountTypeFilter>(() =>
      parseAccountFilterParam(searchParams.get('type'))
    );
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    const paramQuery = searchParams.get('q') || '';
    if (paramQuery !== searchQuery) {
      setSearchQuery(paramQuery);
    }
    const paramType = parseAccountFilterParam(searchParams.get('type'));
    if (paramType !== accountTypeFilter) {
      setAccountTypeFilter(paramType);
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

  const handleAccountTypeFilterChange = (nextType: AdminAccountTypeFilter) => {
    setAccountTypeFilter(nextType);
    const nextParams = new URLSearchParams(searchParams);
    if (nextType === 'all') {
      nextParams.delete('type');
    } else {
      nextParams.set('type', nextType);
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

  const accountCounts = useMemo(() => {
    const marketers = users.filter((u) => u.accountType === 'business').length;
    const students = users.length - marketers;
    return {
      all: users.length,
      student: students,
      business: marketers,
    };
  }, [users]);

  const filteredUsers = useMemo(
    () => filterAdminUsers(users, searchQuery, accountTypeFilter),
    [users, searchQuery, accountTypeFilter]
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
          {/* Account Type Filter Tabs + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Filter users by account type"
              className="inline-flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 self-start"
            >
              {(
                [
                  { id: 'all', label: 'All Users', count: accountCounts.all },
                  {
                    id: 'student',
                    label: 'Student Sellers',
                    count: accountCounts.student,
                  },
                  {
                    id: 'business',
                    label: 'Marketers',
                    count: accountCounts.business,
                  },
                ] as const
              ).map((tab) => {
                const active = accountTypeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleAccountTypeFilterChange(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs md:max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search name, business, email, phone, campus..."
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
                      <th className="py-3.5 px-4">Account &amp; Role</th>
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
                      const isMarketer = account.accountType === 'business';
                      const roleBadge = getPrimaryUserRoleBadge(account);

                      return (
                        <tr key={account.uid} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <UserAvatar
                                uid={account.uid}
                                src={getUserAvatarUrl(account)}
                                name={account.fullName}
                                email={account.email}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 inline-flex items-center gap-1.5">
                                  <span className="truncate">
                                    {account.fullName ||
                                      account.businessName ||
                                      'Unnamed Member'}
                                  </span>
                                  {account.isVerified && (
                                    <VerifiedBadge
                                      size="xs"
                                      label={getVerifiedBadgeLabel(
                                        account.accountType
                                      )}
                                    />
                                  )}
                                </div>
                                {isMarketer ? (
                                  <div className="text-xs text-slate-500 truncate">
                                    {[
                                      account.businessName,
                                      account.isOnlineOnly
                                        ? 'Online Only'
                                        : account.shopAddress || 'Physical Shop',
                                    ]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </div>
                                ) : (
                                  (account.campus || account.department) && (
                                    <div className="text-xs text-slate-500 truncate">
                                      {[account.campus, account.department]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            <div className="truncate">{account.email}</div>
                            {account.phone && (
                              <div className="text-xs text-slate-500 tabular-nums">
                                {account.phone}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                                isMarketer
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {roleBadge}
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
