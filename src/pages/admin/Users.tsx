import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Ban,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  GraduationCap,
  Loader2,
  Mail,
  Pencil,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Store,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  CAMPUS_OPTIONS,
  GRADUATE_LEVEL,
  LEVELS_BY_CAMPUS,
  handleCampusCascade,
  isValidCampus,
} from '../../lib/academicData';
import {
  AdminAccountTypeFilter,
  filterAdminUsers,
  getPrimaryUserRoleBadge,
} from '../../lib/adminHelpers';
import { getUserAvatarUrl, isMarketerProfile } from '../../lib/authHelpers';
import { compressImageToBase64 } from '../../lib/imageUtils';
import { getVerifiedBadgeLabel } from '../../lib/verificationHelpers';
import {
  AdminOverrideUserInput,
  banUserAccount,
  getAllUsers,
  updateUserAccountStatus,
  updateUserProfileAdmin,
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const [editForm, setEditForm] = useState<AdminOverrideUserInput>({
    fullName: '',
    phone: '',
    accountType: 'student',
    campus: 'LASUED',
    department: '',
    level: '100L',
    businessName: '',
    isVerified: false,
    status: 'active',
    profilePic: '',
  });

  const populateEditForm = useCallback((account: UserProfile) => {
    const resolvedType: AccountType = isMarketerProfile(account)
      ? 'business'
      : 'student';
    setEditForm({
      fullName: account.fullName || '',
      phone: account.phone || '',
      accountType: resolvedType,
      campus: account.campus?.trim() || 'LASUED',
      department: account.department || '',
      level: account.level?.trim() || '',
      businessName: account.businessName || '',
      isVerified: Boolean(account.isVerified),
      status: account.status === 'suspended' ? 'suspended' : 'active',
      profilePic: getUserAvatarUrl(account) || '',
    });
  }, []);

  const openInspectModal = useCallback(
    (account: UserProfile) => {
      setConfirmBanUid(null);
      setInspectUser(account);
      populateEditForm(account);
    },
    [populateEditForm]
  );

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
      setUsers((prev) => {
        const next = prev.map(applyUpdate);
        setFastCache('admin_users', next);
        return next;
      });
      setInspectUser((prev) => {
        if (!prev) return null;
        const updated = applyUpdate(prev);
        if (updated.uid === target.uid) {
          setEditForm((form) => ({
            ...form,
            status: nextStatus,
          }));
        }
        return updated;
      });
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
      setUsers((prev) => {
        const next = prev.map(applyBan);
        setFastCache('admin_users', next);
        return next;
      });
      setInspectUser((prev) => {
        if (!prev) return null;
        const updated = applyBan(prev);
        if (updated.uid === target.uid) {
          setEditForm((form) => ({ ...form, status: 'suspended' }));
        }
        return updated;
      });
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

  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const compressed = await compressImageToBase64(file);
      setEditForm((prev) => ({ ...prev, profilePic: compressed }));
      showToast('Profile photo compressed and ready to save.', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to process profile image.',
        'error'
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveOverride = async (e: FormEvent) => {
    e.preventDefault();
    if (!inspectUser?.uid || busyUid) return;

    if (!editForm.fullName.trim()) {
      showToast('Full Name cannot be empty.', 'error');
      return;
    }

    if (
      inspectUser.uid === currentUser?.uid &&
      editForm.status === 'suspended'
    ) {
      showToast('You cannot suspend your own active admin account.', 'info');
      return;
    }

    setBusyUid(inspectUser.uid);
    try {
      await updateUserProfileAdmin(inspectUser.uid, editForm);

      const applyOverride = (u: UserProfile): UserProfile => {
        if (u.uid !== inspectUser.uid) return u;
        const nextRoles = { ...u.roles };
        if (editForm.accountType === 'student') {
          delete nextRoles.landlord;
        }
        return {
          ...u,
          fullName: editForm.fullName.trim(),
          phone: editForm.phone.trim(),
          accountType: editForm.accountType,
          campus: editForm.campus.trim(),
          department: editForm.department.trim(),
          level: editForm.level.trim(),
          businessName:
            editForm.accountType === 'business'
              ? editForm.businessName.trim()
              : undefined,
          shopAddress:
            editForm.accountType === 'business' ? u.shopAddress : undefined,
          isOnlineOnly:
            editForm.accountType === 'business' ? u.isOnlineOnly : undefined,
          isVerified: Boolean(editForm.isVerified),
          status: editForm.status,
          ...(editForm.status === 'active' ? { isBanned: false } : {}),
          profilePic: editForm.profilePic.trim() || undefined,
          avatarUrl: editForm.profilePic.trim() || undefined,
          roles: nextRoles,
        };
      };

      setUsers((prev) => {
        const next = prev.map(applyOverride);
        setFastCache('admin_users', next);
        return next;
      });
      setInspectUser((prev) => (prev ? applyOverride(prev) : null));
      showToast(
        `Saved admin overrides for ${editForm.fullName.trim()}.`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Failed to save user profile overrides.',
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
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg" />
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
              className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 self-start"
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
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
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
                className="block w-full pl-10 pr-9 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  aria-label="Clear user search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching users found.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-3.5 px-4">Name</th>
                      <th className="py-3.5 px-4">Email &amp; Phone</th>
                      <th className="py-3.5 px-4">Account &amp; Role</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
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
                        <tr
                          key={account.uid}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                        >
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
                                <div className="font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openInspectModal(account)}
                                    className="truncate hover:text-primary-600 dark:hover:text-blue-400 hover:underline text-left"
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
                                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
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
                                  (account.campus || account.department || account.level) && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                      {[account.campus, account.department, account.level]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                            <div className="truncate">{account.email}</div>
                            {account.phone && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                {account.phone}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                                isMarketer
                                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {roleBadge}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isSuspended ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  <span>Suspended</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Active</span>
                                </span>
                              )}
                              {isBanned && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900 dark:bg-slate-700 text-white">
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
                                onClick={() => openInspectModal(account)}
                                aria-label={`Inspect and edit ${account.fullName || account.email}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Inspect / Edit</span>
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

      {/* Inspect & Override User Modal (Admin God Mode) */}
      {inspectUser && (() => {
        const isMarketer = editForm.accountType === 'business';
        const isSuspended = inspectUser.status === 'suspended';
        const isBanned = inspectUser.isBanned === true;
        const isSelf = inspectUser.uid === currentUser?.uid;
        const isBusy = busyUid === inspectUser.uid;
        const roleBadge = getPrimaryUserRoleBadge({
          ...inspectUser,
          accountType: editForm.accountType,
        });
        const hasGps =
          typeof inspectUser.latitude === 'number' &&
          typeof inspectUser.longitude === 'number';
        const availableLevels = isValidCampus(editForm.campus)
          ? [...LEVELS_BY_CAMPUS[editForm.campus], GRADUATE_LEVEL]
          : [...LEVELS_BY_CAMPUS.LASU, GRADUATE_LEVEL];

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
              className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    uid={inspectUser.uid}
                    src={editForm.profilePic || getUserAvatarUrl(inspectUser)}
                    name={editForm.fullName || inspectUser.fullName}
                    email={inspectUser.email}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2
                        id="inspect-user-modal-title"
                        className="text-base font-bold text-slate-900 dark:text-white truncate"
                      >
                        {editForm.fullName ||
                          editForm.businessName ||
                          inspectUser.fullName ||
                          'Unnamed Member'}
                      </h2>
                      {editForm.isVerified && (
                        <VerifiedBadge
                          size="xs"
                          accountType={isMarketer ? 'business' : 'student'}
                          label={getVerifiedBadgeLabel(
                            isMarketer ? 'business' : 'student'
                          )}
                        />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
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
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => void handleSaveOverride(e)}
                className="flex flex-col flex-1 min-h-0"
              >
                <div className="p-5 space-y-5 overflow-y-auto flex-1">
                  {/* Summary Status Pills */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                        isMarketer
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {roleBadge}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        inspectUser.emailVerified
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {inspectUser.emailVerified
                        ? 'Email Verified'
                        : 'Email Unverified'}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        editForm.isVerified
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {editForm.isVerified ? 'ID Verified' : 'ID Unverified'}
                    </span>
                  </div>

                  {/* Account Contact Summary */}
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-300">
                    <div className="space-y-1 min-w-0">
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
                    </div>
                    <StarRating
                      rating={inspectUser.trustScore ?? 0}
                      reviewCount={inspectUser.reviewCount ?? 0}
                      size="xs"
                    />
                  </div>

                  {/* Profile Picture Override */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/40">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          uid={inspectUser.uid}
                          src={editForm.profilePic}
                          name={editForm.fullName || inspectUser.fullName}
                          email={inspectUser.email}
                          size="lg"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            Profile Picture Override
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Upload a new compressed Base64 photo bypassing user lock rules.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          ref={avatarFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => void handleAvatarFileChange(e)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingAvatar || isBusy}
                          onClick={() => avatarFileInputRef.current?.click()}
                        >
                          {uploadingAvatar ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Camera className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {uploadingAvatar ? 'Compressing...' : 'Upload Photo'}
                          </span>
                        </Button>
                        {editForm.profilePic && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingAvatar || isBusy}
                            onClick={() =>
                              setEditForm((prev) => ({
                                ...prev,
                                profilePic: '',
                              }))
                            }
                            className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Admin God Mode Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="admin-edit-fullname"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="admin-edit-fullname"
                        type="text"
                        required
                        value={editForm.fullName}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            fullName: e.target.value,
                          }))
                        }
                        className="block w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="admin-edit-phone"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Phone Number
                      </label>
                      <input
                        id="admin-edit-phone"
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        placeholder="e.g. 08012345678"
                        className="block w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="admin-edit-account-type"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Account Type
                      </label>
                      <select
                        id="admin-edit-account-type"
                        value={editForm.accountType}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            accountType:
                              e.target.value === 'business'
                                ? 'business'
                                : 'student',
                          }))
                        }
                        className="block w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="student">Student</option>
                        <option value="business">Marketer</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="admin-edit-status"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Account Status
                      </label>
                      <select
                        id="admin-edit-status"
                        value={editForm.status}
                        disabled={isSelf}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            status:
                              e.target.value === 'suspended'
                                ? 'suspended'
                                : 'active',
                          }))
                        }
                        className="block w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="admin-edit-campus"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Campus
                      </label>
                      <select
                        id="admin-edit-campus"
                        value={editForm.campus}
                        onChange={(e) => {
                          const cascaded = handleCampusCascade(
                            e.target.value,
                            editForm.level
                          );
                          setEditForm((prev) => ({
                            ...prev,
                            campus: e.target.value,
                            level:
                              prev.level === GRADUATE_LEVEL
                                ? GRADUATE_LEVEL
                                : cascaded.level || prev.level,
                          }));
                        }}
                        className="block w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {CAMPUS_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="admin-edit-level"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Level
                      </label>
                      <select
                        id="admin-edit-level"
                        value={editForm.level}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            level: e.target.value,
                          }))
                        }
                        className="block w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Not Set</option>
                        {availableLevels.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <label
                        htmlFor="admin-edit-department"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        Department
                      </label>
                      <input
                        id="admin-edit-department"
                        type="text"
                        value={editForm.department}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            department: e.target.value,
                          }))
                        }
                        placeholder="e.g. Computer Science"
                        className="block w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {isMarketer && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <label
                          htmlFor="admin-edit-business-name"
                          className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                        >
                          Business / Brand Name
                        </label>
                        <input
                          id="admin-edit-business-name"
                          type="text"
                          value={editForm.businessName}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              businessName: e.target.value,
                            }))
                          }
                          placeholder="e.g. Solva Tech Gadgets"
                          className="block w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* Verified Toggle Switch */}
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Verified Status (isVerified)
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Grants or revokes the verified badge across profile and all listings.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editForm.isVerified}
                      aria-label="Toggle verified status"
                      onClick={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          isVerified: !prev.isVerified,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        editForm.isVerified
                          ? 'bg-emerald-600'
                          : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                          editForm.isVerified ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Existing Shop / Academic Inspection Context */}
                  {isMarketer ? (
                    <div className="rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 p-4 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      <p className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
                        <span>Marketer Storefront Details</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        {inspectUser.isOnlineOnly ? (
                          <>
                            <Globe className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Online Only · Available anytime</span>
                          </>
                        ) : (
                          <>
                            <Building2 className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
                            <span>
                              Physical Shop:{' '}
                              <strong className="text-slate-900 dark:text-white">
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
                          className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Shop GPS Pin on Map</span>
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3.5 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <GraduationCap className="w-4 h-4 text-primary-600 dark:text-blue-400 shrink-0" />
                      <span>
                        Student account changes save directly to{' '}
                        <code className="font-mono text-slate-900 dark:text-white">
                          users/{inspectUser.uid}
                        </code>{' '}
                        and propagate across listings automatically.
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer Save + Moderation Controls */}
                <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2.5">
                  {!isSelf && !isBanned ? (
                    confirmBanUid === inspectUser.uid ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => void handleBanUser(inspectUser)}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Confirm Ban</span>
                        </Button>
                        <Button
                          type="button"
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
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => setConfirmBanUid(inspectUser.uid)}
                        className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/50"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Ban Permanently</span>
                      </Button>
                    )
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {isSelf ? 'Active Admin Session' : 'Permanently Banned'}
                    </span>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      type="button"
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

                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={isBusy || uploadingAvatar}
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>{isBusy ? 'Saving...' : 'Save Changes'}</span>
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </AdminLayout>
  );
}

