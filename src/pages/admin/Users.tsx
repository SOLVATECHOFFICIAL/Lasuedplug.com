import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Ban,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Globe,
  GraduationCap,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
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
import { getUserAvatarUrl, isMarketerProfile } from '../../lib/authHelpers';
import { getVerifiedBadgeLabel } from '../../lib/verificationHelpers';
import {
  banUserAccount,
  getAllUsers,
  updateUserAccountStatus,
  updateUserAccountTypeAdmin,
} from '../../lib/adminService';
import { getFastCache, setFastCache } from '../../lib/fastCache';
import { AccountType, UserProfile } from '../../types';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Button } from '../../components/ui/Button';
import { StarRating } from '../../components/ui/StarRating';
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
  const [inspectUser, setInspectUser] = useState<UserProfile | null>(null);
  const [confirmBanUid, setConfirmBanUid] = useState<string | null>(null);

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

  useEffect(() => {
    if (!inspectUser) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyUid) {
        setInspectUser(null);
        setConfirmBanUid(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inspectUser, busyUid]);

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
      setInspectUser((prev) =>
        prev ? data.find((u) => u.uid === prev.uid) ?? prev : null
      );
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
    const marketers = users.filter((u) => isMarketerProfile(u)).length;
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
      const applyUpdate = (u: UserProfile): UserProfile =>
        u.uid === target.uid
          ? {
              ...u,
              status: nextStatus,
              ...(nextStatus === 'active' ? { isBanned: false } : {}),
            }
          : u;
      setUsers((prev) => prev.map(applyUpdate));
      setInspectUser((prev) => (prev ? applyUpdate(prev) : null));
      setConfirmBanUid(null);
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

  const handleBanUser = async (target: UserProfile) => {
    if (!target.uid || busyUid) return;
    if (target.uid === currentUser?.uid) {
      showToast('You cannot ban your own admin account.', 'info');
      return;
    }

    setBusyUid(target.uid);
    try {
      await banUserAccount(target.uid);
      const applyBan = (u: UserProfile): UserProfile =>
        u.uid === target.uid ? { ...u, status: 'suspended', isBanned: true } : u;
      setUsers((prev) => prev.map(applyBan));
      setInspectUser((prev) => (prev ? applyBan(prev) : null));
      setConfirmBanUid(null);
      showToast(
        `${target.fullName || target.email} has been permanently banned.`,
        'info'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to ban user account.',
        'error'
      );
    } finally {
      setBusyUid(null);
    }
  };

  const handleSwitchAccountType = async (
    target: UserProfile,
    nextType: AccountType
  ) => {
    if (!target.uid || busyUid) return;
    const currentlyMarketer = isMarketerProfile(target);
    if (
      (nextType === 'business' && currentlyMarketer) ||
      (nextType === 'student' && !currentlyMarketer)
    ) {
      return;
    }

    setBusyUid(target.uid);
    try {
      await updateUserAccountTypeAdmin(target.uid, nextType);
      const applyTypeUpdate = (u: UserProfile): UserProfile => {
        if (u.uid !== target.uid) return u;
        if (nextType === 'student') {
          const nextRoles = { ...u.roles };
          delete nextRoles.landlord;
          return {
            ...u,
            accountType: 'student',
            roles: nextRoles,
            businessName: undefined,
            shopAddress: undefined,
            isOnlineOnly: undefined,
          };
        }
        return {
          ...u,
          accountType: 'business',
        };
      };
      setUsers((prev) => prev.map(applyTypeUpdate));
      setInspectUser((prev) => (prev ? applyTypeUpdate(prev) : null));
      showToast(
        `Switched ${target.fullName || target.email} to ${
          nextType === 'business' ? 'Marketer' : 'Student'
        }.`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Failed to switch account type.',
        'error'
      );
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <AdminLayout
      title="Users Management"
      subtitle="View Student sellers and Marketers separately, inspect shop & profile details, switch misclassified roles, or suspend accounts."
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
                      <th className="py-3.5 px-4">Email &amp; Phone</th>
                      <th className="py-3.5 px-4">Account &amp; Role</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredUsers.map((account) => {
                      const isSuspended = account.status === 'suspended';
                      const isBanned = account.isBanned === true;
                      const isSelf = account.uid === currentUser?.uid;
                      const isBusy = busyUid === account.uid;
                      const isMarketer = isMarketerProfile(account);
                      const roleBadge = getPrimaryUserRoleBadge(account);
                      const resolvedType: AccountType = isMarketer
                        ? 'business'
                        : 'student';

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
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmBanUid(null);
                                      setInspectUser(account);
                                    }}
                                    className="truncate hover:text-primary-600 hover:underline text-left"
                                  >
                                    {account.fullName ||
                                      account.businessName ||
                                      'Unnamed Member'}
                                  </button>
                                  {account.isVerified && (
                                    <VerifiedBadge
                                      size="xs"
                                      accountType={resolvedType}
                                      label={getVerifiedBadgeLabel(resolvedType)}
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
                                      !account.isOnlineOnly ? account.openingHours : '',
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
                            <div className="inline-flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setConfirmBanUid(null);
                                  setInspectUser(account);
                                }}
                                aria-label={`Inspect ${account.fullName || account.email}`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Inspect</span>
                              </Button>

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
                            </div>
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

      {/* Inspect & Manage User Modal */}
      {inspectUser && (() => {
        const isMarketer = isMarketerProfile(inspectUser);
        const isSuspended = inspectUser.status === 'suspended';
        const isBanned = inspectUser.isBanned === true;
        const isSelf = inspectUser.uid === currentUser?.uid;
        const isBusy = busyUid === inspectUser.uid;
        const roleBadge = getPrimaryUserRoleBadge(inspectUser);
        const hasGps =
          typeof inspectUser.latitude === 'number' &&
          typeof inspectUser.longitude === 'number';

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspect-user-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              if (!busyUid) {
                setInspectUser(null);
                setConfirmBanUid(null);
              }
            }}
          >
            <div
              className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    uid={inspectUser.uid}
                    src={getUserAvatarUrl(inspectUser)}
                    name={inspectUser.fullName}
                    email={inspectUser.email}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2
                        id="inspect-user-modal-title"
                        className="text-base font-bold text-slate-900 truncate"
                      >
                        {inspectUser.fullName ||
                          inspectUser.businessName ||
                          'Unnamed Member'}
                      </h2>
                      {inspectUser.isVerified && (
                        <VerifiedBadge
                          size="xs"
                          accountType={isMarketer ? 'business' : 'student'}
                          label={getVerifiedBadgeLabel(
                            isMarketer ? 'business' : 'student'
                          )}
                        />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono truncate">
                      UID: {inspectUser.uid}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(busyUid)}
                  onClick={() => {
                    setInspectUser(null);
                    setConfirmBanUid(null);
                  }}
                  aria-label="Close user inspector"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5 overflow-y-auto">
                {/* Summary Status Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                      isMarketer
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {roleBadge}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      inspectUser.emailVerified
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {inspectUser.emailVerified
                      ? 'Email Verified'
                      : 'Email Unverified'}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      inspectUser.isVerified
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {inspectUser.isVerified ? 'ID Verified' : 'ID Unverified'}
                  </span>
                </div>

                {/* Contact & Rating */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{inspectUser.email}</span>
                  </div>
                  {inspectUser.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="tabular-nums">{inspectUser.phone}</span>
                    </div>
                  )}
                  <div className="pt-1">
                    <StarRating
                      rating={inspectUser.trustScore ?? 0}
                      reviewCount={inspectUser.reviewCount ?? 0}
                      size="xs"
                    />
                  </div>
                </div>

                {/* Role-Specific Details: Marketer Shop vs Student Academic */}
                {isMarketer ? (
                  <div className="rounded-xl bg-indigo-50/50 border border-indigo-200 p-4 space-y-2 text-xs text-slate-700">
                    <p className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <Store className="w-4 h-4 text-indigo-700" />
                      <span>Marketer Storefront Details</span>
                    </p>
                    <p>
                      <span className="text-slate-500">Brand Name:</span>{' '}
                      <span className="font-semibold text-slate-900">
                        {inspectUser.businessName || 'Not provided yet'}
                      </span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      {inspectUser.isOnlineOnly ? (
                        <>
                          <Globe className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Online Only · Available anytime</span>
                        </>
                      ) : (
                        <>
                          <Building2 className="w-3.5 h-3.5 text-indigo-700" />
                          <span>
                            Physical Shop:{' '}
                            <strong className="text-slate-900">
                              {inspectUser.shopAddress || 'Address not entered'}
                            </strong>
                          </span>
                        </>
                      )}
                    </p>
                    {!inspectUser.isOnlineOnly && inspectUser.openingHours && (
                      <p className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Hours: {inspectUser.openingHours}</span>
                      </p>
                    )}
                    {!inspectUser.isOnlineOnly && hasGps && (
                      <a
                        href={`https://www.google.com/maps?q=${inspectUser.latitude},${inspectUser.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline pt-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View Shop GPS Pin on Map</span>
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1.5 text-xs text-slate-700">
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-primary-600" />
                      <span>Student Academic Record</span>
                    </p>
                    <p>
                      <span className="text-slate-500">Campus:</span>{' '}
                      <strong className="text-slate-900">
                        {inspectUser.campus || 'Not set'}
                      </strong>
                    </p>
                    <p>
                      <span className="text-slate-500">Department:</span>{' '}
                      <strong className="text-slate-900">
                        {inspectUser.department || 'Not set'}
                      </strong>
                    </p>
                    <p>
                      <span className="text-slate-500">Level:</span>{' '}
                      <strong className="text-slate-900">
                        {inspectUser.level || 'Not set'}
                      </strong>
                    </p>
                  </div>
                )}

                {/* Admin Account Type Switcher */}
                <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Admin Classification Override
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Fix misclassified accounts and sync existing listings automatically.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={!isMarketer ? 'primary' : 'outline'}
                      size="sm"
                      disabled={isBusy || !isMarketer}
                      onClick={() =>
                        void handleSwitchAccountType(inspectUser, 'student')
                      }
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>Set as Student</span>
                    </Button>
                    <Button
                      variant={isMarketer ? 'primary' : 'outline'}
                      size="sm"
                      disabled={isBusy || isMarketer}
                      onClick={() =>
                        void handleSwitchAccountType(inspectUser, 'business')
                      }
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Set as Marketer</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Footer Moderation Controls */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                {!isSelf && !isBanned ? (
                  confirmBanUid === inspectUser.uid ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void handleBanUser(inspectUser)}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Confirm Permanent Ban</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => setConfirmBanUid(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => setConfirmBanUid(inspectUser.uid)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Ban Permanently</span>
                    </Button>
                  )
                ) : (
                  <span className="text-xs text-slate-500">
                    {isSelf
                      ? 'Active Admin Session'
                      : 'Permanently Banned'}
                  </span>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant={isSuspended ? 'outline' : 'danger'}
                    size="sm"
                    disabled={isBusy || isSelf}
                    onClick={() => void handleToggleStatus(inspectUser)}
                  >
                    {isBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isSuspended ? (
                      <UserCheck className="w-3.5 h-3.5" />
                    ) : (
                      <UserX className="w-3.5 h-3.5" />
                    )}
                    <span>{isSuspended ? 'Unsuspend' : 'Suspend'}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </AdminLayout>
  );
}

