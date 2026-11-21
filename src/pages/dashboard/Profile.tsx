import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Globe,
  GraduationCap,
  ImagePlus,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Save,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  ACADEMIC_LOCK_MESSAGE,
  ACCOUNT_TYPE_LOCK_MESSAGE,
  areMarketerProfileFieldsLocked,
  getFieldCooldownStatus,
  getPrimaryRoleLabel,
  getProfilePicLockStatus,
  getUserAvatarUrl,
  isAcademicFieldLocked,
  MARKETER_LOCK_MESSAGE,
  NAME_LOCK_MESSAGE,
  parseOpeningHoursRange,
  PHONE_UPDATE_COOLDOWN_DAYS,
  resolveAccountType,
} from '../../lib/authHelpers';
import { SUPPORT_LINK } from '../../lib/constants';
import {
  CAMPUS_OPTIONS,
  getLevelsForCampus,
  handleCampusCascade,
  isGraduateLevel,
} from '../../lib/academicData';
import { compressImageToBase64, isImageFile } from '../../lib/imageUtils';
import {
  formatOpeningHoursRange,
  isValidGpsCoordinates,
} from '../../lib/listingValidation';
import {
  getVerificationDocOptions,
  getVerificationUiState,
  getVerifiedBadgeLabel,
} from '../../lib/verificationHelpers';
import {
  getUserVerificationRequests,
  submitVerificationRequest,
} from '../../lib/verificationService';
import { AccountType, VerificationRequest } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { StarRating } from '../../components/ui/StarRating';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { LocationPinField } from '../../components/forms/LocationPinField';
import { SeoHead } from '../../components/seo/SeoHead';

interface FieldErrors {
  fullName?: string;
  phone?: string;
  campus?: string;
  department?: string;
  level?: string;
  businessName?: string;
  openingHours?: string;
  shopAddress?: string;
  gps?: string;
}

function formatUnlockDate(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ensureOptionPresent(
  options: readonly string[],
  currentValue: string
): readonly string[] {
  if (!currentValue || options.includes(currentValue)) {
    return options;
  }
  return [currentValue, ...options];
}

export function ProfilePage() {
  const {
    user,
    profile,
    isProfileComplete,
    updateUserProfile,
    updateProfilePicture,
  } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const shownRedirectToastRef = useRef<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [campus, setCampus] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [openingTimeStart, setOpeningTimeStart] = useState('08:00');
  const [openingTimeEnd, setOpeningTimeEnd] = useState('18:00');
  const [hasPhysicalShop, setHasPhysicalShop] = useState(true);
  const [shopAddress, setShopAddress] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Profile picture (DP) upload state
  const [uploadingPic, setUploadingPic] = useState(false);
  const [picError, setPicError] = useState<string | null>(null);
  const dpFileInputRef = useRef<HTMLInputElement | null>(null);

  // Identity Verification workflow state (Student ID for Students, NIN/Driver's License for Marketers)
  const [verificationRequests, setVerificationRequests] = useState<
    VerificationRequest[]
  >([]);
  const [loadingVerification, setLoadingVerification] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyDocType, setVerifyDocType] = useState<string>('');
  const [verifyImageBase64, setVerifyImageBase64] = useState<string | null>(
    null
  );
  const [verifyImageName, setVerifyImageName] = useState<string>('');
  const [compressingDoc, setCompressingDoc] = useState(false);
  const [submittingVerify, setSubmittingVerify] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const verifyFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const state = location.state as { toastMessage?: string } | null;
    const msg = state?.toastMessage;
    if (msg && shownRedirectToastRef.current !== msg) {
      shownRedirectToastRef.current = msg;
      showToast(msg, 'info');
    }
  }, [location.state, showToast]);

  useEffect(() => {
    setFullName(profile?.fullName || user?.displayName || '');
    setPhone(profile?.phone || '');
    setCampus(profile?.campus || '');
    setDepartment(profile?.department || '');
    setLevel(profile?.level || '');
    setBusinessName(profile?.businessName || '');
    const parsedTimes = parseOpeningHoursRange(profile?.openingHours);
    setOpeningTimeStart(
      profile?.openingTimeStart || parsedTimes.start || '08:00'
    );
    setOpeningTimeEnd(profile?.openingTimeEnd || parsedTimes.end || '18:00');
    setHasPhysicalShop(profile?.isOnlineOnly !== true);
    setShopAddress(profile?.shopAddress || '');
    setLatitude(profile?.latitude);
    setLongitude(profile?.longitude);
  }, [profile, user]);

  const loadVerificationHistory = useCallback(async () => {
    if (!user?.uid) {
      setVerificationRequests([]);
      return;
    }
    setLoadingVerification(true);
    try {
      const items = await getUserVerificationRequests(user.uid);
      setVerificationRequests(items);
    } catch {
      // Silently preserve state if offline/unconfigured
    } finally {
      setLoadingVerification(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void loadVerificationHistory();
  }, [loadVerificationHistory]);

  const accountType: AccountType = resolveAccountType(profile);
  const isBusinessAccount = accountType === 'business';
  const isMarketerLocked = areMarketerProfileFieldsLocked(profile);
  const isNameLocked = isAcademicFieldLocked(profile?.fullName);
  const isCampusLocked = isAcademicFieldLocked(profile?.campus);
  const isDepartmentLocked = isAcademicFieldLocked(profile?.department);
  const isLevelLocked = isAcademicFieldLocked(profile?.level);
  const anyAcademicLocked =
    isCampusLocked || isDepartmentLocked || isLevelLocked;
  const hasGraduated = !isBusinessAccount && isGraduateLevel(profile?.level);

  const phoneCooldown = useMemo(
    () =>
      getFieldCooldownStatus(
        profile?.lastPhoneUpdate,
        PHONE_UPDATE_COOLDOWN_DAYS
      ),
    [profile?.lastPhoneUpdate]
  );

  const campusOptions = useMemo(
    () => ensureOptionPresent(CAMPUS_OPTIONS, campus),
    [campus]
  );

  const levelOptions = useMemo(() => {
    const base = getLevelsForCampus(campus);
    return ensureOptionPresent(base, level);
  }, [campus, level]);

  const displayName = profile?.fullName || user?.displayName || 'Campus Member';
  const email = profile?.email || user?.email || '';
  const avatarSrc = getUserAvatarUrl(profile);
  const picLock = useMemo(
    () => getProfilePicLockStatus(profile?.profilePicUpdatedAt),
    [profile?.profilePicUpdatedAt]
  );
  const roleLabel = getPrimaryRoleLabel(profile?.roles, accountType);
  const isVerified = Boolean(profile?.isVerified);
  const verifiedBadgeLabel = getVerifiedBadgeLabel(accountType);
  const verificationDocOptions = useMemo(
    () => getVerificationDocOptions(accountType),
    [accountType]
  );
  const verificationUiState = useMemo(
    () => getVerificationUiState(isVerified, verificationRequests),
    [isVerified, verificationRequests]
  );
  const formattedHoursPreview = formatOpeningHoursRange(
    openingTimeStart,
    openingTimeEnd
  );

  const allEditableFieldsLocked = isBusinessAccount
    ? isNameLocked && phoneCooldown.isLocked && isMarketerLocked
    : isNameLocked &&
      phoneCooldown.isLocked &&
      isCampusLocked &&
      isDepartmentLocked &&
      isLevelLocked;

  const clearFieldError = (key: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleCampusChange = (nextCampus: string) => {
    if (isCampusLocked) return;
    const cascaded = handleCampusCascade(nextCampus, level);
    setCampus(cascaded.campus);
    if (!isLevelLocked) {
      setLevel(cascaded.level);
    }
    clearFieldError('campus');
    clearFieldError('level');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSavedNotice(null);

    const errors: FieldErrors = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full name is required (at least 2 characters).';
    }
    if (!phone.trim() || phone.trim().length < 7) {
      errors.phone = 'A valid phone/WhatsApp number is required.';
    }

    if (isBusinessAccount) {
      if (!businessName.trim() || businessName.trim().length < 2) {
        errors.businessName =
          'Business / brand name is required (at least 2 characters).';
      }
      if (hasPhysicalShop) {
        if (!openingTimeStart.trim() || !openingTimeEnd.trim()) {
          errors.openingHours = 'Please choose both opening and closing times.';
        } else if (openingTimeStart.trim() === openingTimeEnd.trim()) {
          errors.openingHours = 'Opening and closing times cannot be the same.';
        }
        if (!shopAddress.trim() || shopAddress.trim().length < 3) {
          errors.shopAddress =
            'Physical shop address is required unless you operate Online Only.';
        }
        if (!isValidGpsCoordinates(latitude, longitude)) {
          errors.gps =
            'Please pin your physical shop GPS location before saving.';
        }
      }
    } else {
      if (!campus.trim()) {
        errors.campus = 'Please select your campus.';
      }
      if (!department.trim() || department.trim().length < 2) {
        errors.department = 'Please enter your department.';
      }
      if (!level.trim()) {
        errors.level = 'Please select your level.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstErr = Object.values(errors)[0];
      if (firstErr) showToast(firstErr, 'error');
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile({
        fullName,
        phone,
        accountType,
        ...(isBusinessAccount
          ? {
              businessName,
              openingHours: hasPhysicalShop ? formattedHoursPreview : '',
              openingTimeStart: hasPhysicalShop ? openingTimeStart : '',
              openingTimeEnd: hasPhysicalShop ? openingTimeEnd : '',
              isOnlineOnly: !hasPhysicalShop,
              shopAddress: hasPhysicalShop ? shopAddress : '',
              latitude: hasPhysicalShop ? latitude : undefined,
              longitude: hasPhysicalShop ? longitude : undefined,
            }
          : {
              campus,
              department,
              level,
            }),
      });
      const msg = 'Profile updated successfully.';
      setSavedNotice(msg);
      showToast(msg, 'success');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to save profile changes. Please try again.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePicSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (picLock.isLocked) {
      if (picLock.lockMessage) {
        setPicError(picLock.lockMessage);
        showToast(picLock.lockMessage, 'info');
      }
      return;
    }

    if (!isImageFile(file)) {
      const msg = 'Please select a valid image file (JPG, PNG, or WEBP).';
      setPicError(msg);
      showToast(msg, 'error');
      return;
    }

    setPicError(null);
    setUploadingPic(true);
    try {
      const compressed = await compressImageToBase64(file);
      await updateProfilePicture(compressed);
      showToast('Profile picture updated! Locked for 7 days.', 'success');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to update profile picture. Please try again.';
      setPicError(msg);
      showToast(msg, 'error');
    } finally {
      setUploadingPic(false);
    }
  };

  const handleOpenVerifyModal = () => {
    setVerifyError(null);
    setVerifyDocType(verificationDocOptions[0] || '');
    setVerifyImageBase64(null);
    setVerifyImageName('');
    setVerifyModalOpen(true);
  };

  const handleSelectVerifyDocument = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!isImageFile(file)) {
      setVerifyError('Please select a valid image file (JPG, PNG, or WEBP).');
      return;
    }

    setVerifyError(null);
    setCompressingDoc(true);
    try {
      const compressed = await compressImageToBase64(file);
      setVerifyImageBase64(compressed);
      setVerifyImageName(file.name);
    } catch (err) {
      setVerifyError(
        err instanceof Error
          ? err.message
          : 'Unable to process image. Please try another photo.'
      );
    } finally {
      setCompressingDoc(false);
    }
  };

  const handleSubmitVerification = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.uid || submittingVerify) return;

    if (!verifyDocType.trim()) {
      setVerifyError('Please choose your verification document type.');
      return;
    }

    if (!verifyImageBase64) {
      setVerifyError(
        isBusinessAccount
          ? "Please upload a clear photo of your NIN, Driver's License, Voter's Card, or Passport."
          : 'Please upload your Student ID card or School Fee receipt.'
      );
      return;
    }

    setVerifyError(null);
    setSubmittingVerify(true);
    try {
      const created = await submitVerificationRequest({
        userId: user.uid,
        fullName: displayName,
        idCardImage: verifyImageBase64,
        accountType,
        documentType: verifyDocType,
      });
      setVerificationRequests((prev) => [created, ...prev]);
      setVerifyModalOpen(false);
      setVerifyImageBase64(null);
      setVerifyImageName('');
      showToast(
        'Verification request submitted! Support will review your document shortly.',
        'success'
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to submit verification request.';
      setVerifyError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmittingVerify(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      <SeoHead
        title="My Profile"
        description="Manage your LASUEDPLUG profile details, academic or marketer information, and verification status."
      />
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          My Profile
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {isBusinessAccount
            ? 'Manage your marketer brand details, operating hours, shop location, and identity verification.'
            : 'Manage your personal details and sealed campus academic record.'}
        </p>
      </div>

      {/* Profile Overview & Circular DP Upload Section */}
      <Card hoverable={false} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <UserAvatar
                uid={user?.uid}
                src={avatarSrc}
                name={displayName}
                email={email}
                size="lg"
                className="ring-2 ring-slate-100 dark:ring-slate-800"
              />
              <button
                type="button"
                disabled={uploadingPic || picLock.isLocked}
                onClick={() => dpFileInputRef.current?.click()}
                aria-label={
                  picLock.isLocked
                    ? picLock.lockMessage || 'Profile picture locked'
                    : avatarSrc
                      ? 'Change profile picture'
                      : 'Upload profile picture'
                }
                title={
                  picLock.isLocked
                    ? picLock.lockMessage || 'Profile picture locked'
                    : avatarSrc
                      ? 'Change profile picture'
                      : 'Upload profile picture'
                }
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingPic ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600 dark:text-primary-400" />
                ) : picLock.isLocked ? (
                  <Lock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                ref={dpFileInputRef}
                type="file"
                accept="image/*"
                disabled={uploadingPic || picLock.isLocked}
                onChange={(e) => void handleProfilePicSelect(e)}
                className="hidden"
                data-testid="profile-pic-input"
              />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {displayName}
                </h2>
                {isVerified && (
                  <BadgeCheck
                    className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0"
                    aria-label={verifiedBadgeLabel}
                  />
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                <Mail className="w-4 h-4 shrink-0" />
                <span className="truncate">{email}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="role">
                  {isBusinessAccount ? 'Marketer' : roleLabel}
                </Badge>
                {isVerified ? (
                  <Badge variant="verified">
                    <Check className="w-3.5 h-3.5 mr-1" />
                    {verifiedBadgeLabel}
                  </Badge>
                ) : verificationUiState === 'pending' ? (
                  <Badge variant="pending">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    Pending
                  </Badge>
                ) : (
                  <Badge variant="pending">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    Unverified
                  </Badge>
                )}
                <Badge variant={isProfileComplete ? 'verified' : 'pending'}>
                  {isProfileComplete ? 'Profile Complete' : 'Incomplete Profile'}
                </Badge>
              </div>
              <div className="pt-1">
                <StarRating
                  rating={profile?.trustScore ?? 0}
                  reviewCount={profile?.reviewCount ?? 0}
                  size="xs"
                />
              </div>
              {!isVerified && verificationUiState === 'pending' && (
                <p className="text-xs text-amber-700 dark:text-amber-400 pt-0.5">
                  Your verification document is awaiting Support review.
                </p>
              )}
              {!isVerified && verificationUiState === 'rejected' && (
                <p className="text-xs text-red-600 dark:text-red-400 pt-0.5">
                  {isBusinessAccount
                    ? "Your previous submission was rejected. Upload a clearer NIN, Driver's License, Voter's Card, or Passport to reapply."
                    : 'Your previous submission was rejected. Upload a clearer Student ID or fee receipt to reapply.'}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingPic || picLock.isLocked}
              onClick={() => dpFileInputRef.current?.click()}
            >
              {uploadingPic ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>{avatarSrc ? 'Change Photo' : 'Upload Photo'}</span>
                </>
              )}
            </Button>

            {!isVerified && verificationUiState !== 'pending' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingVerification}
                onClick={handleOpenVerifyModal}
                className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:border-emerald-300"
              >
                <BadgeCheck className="w-4 h-4" />
                <span>Apply for Verification</span>
              </Button>
            )}
          </div>
        </div>

        {picLock.isLocked && picLock.lockMessage ? (
          <div
            role="status"
            data-testid="profile-pic-lock-notice"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-200"
          >
            <span>{picLock.lockMessage}</span>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Available for both Students and Marketers: upload a clear profile photo (auto-compressed under 100KB). Once updated, you can change it only once a week (7-day lock).
          </p>
        )}

        {picError && (
          <div
            role="alert"
            className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 text-xs font-medium text-red-700 dark:text-red-300"
          >
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <span>{picError}</span>
          </div>
        )}
      </Card>

      {/* Edit Profile Form */}
      <Card hoverable={false} className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Edit Profile Details
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Complete all fields below to unlock buying, selling, and messaging on
            LASUEDPLUG.
          </p>
        </div>

        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 text-sm text-red-700 dark:text-red-300"
          >
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {savedNotice && (
          <div
            role="status"
            className="flex items-start gap-2.5 p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-sm text-emerald-800 dark:text-emerald-200"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>{savedNotice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Account Type (Locked Forever Once Chosen at Signup) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Account Type
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                <Lock className="w-3 h-3" />
                <span>Locked Forever</span>
              </span>
            </div>
            <div
              data-testid="locked-account-type-banner"
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300"
            >
              <div className="flex items-start gap-2.5">
                {isBusinessAccount ? (
                  <Store className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                ) : (
                  <GraduationCap className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Registered as {isBusinessAccount ? 'Marketer' : 'Student'}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">{ACCOUNT_TYPE_LOCK_MESSAGE}</p>
                </div>
              </div>
              <a
                href={SUPPORT_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                Contact Support
              </a>
            </div>
          </div>

          {/* Contact & Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Input
                label="Full Name"
                name="fullName"
                type="text"
                placeholder="e.g. Ada Okafor"
                value={fullName}
                disabled={isNameLocked}
                onChange={(e) => {
                  setFullName(e.target.value);
                  clearFieldError('fullName');
                }}
                error={fieldErrors.fullName}
                helperText={
                  isNameLocked
                    ? NAME_LOCK_MESSAGE
                    : 'Permanently locked once saved.'
                }
                required
              />
            </div>

            <Input
              label="Phone / WhatsApp Number"
              name="phone"
              type="tel"
              placeholder="e.g. 08012345678"
              value={phone}
              disabled={phoneCooldown.isLocked}
              onChange={(e) => {
                setPhone(e.target.value);
                clearFieldError('phone');
              }}
              error={fieldErrors.phone}
              helperText={
                phoneCooldown.isLocked
                  ? `Phone locked until ${formatUnlockDate(phoneCooldown.nextAvailableDate)}.`
                  : 'Can only be updated once every 7 days.'
              }
              required
            />
          </div>

          {isBusinessAccount ? (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                    Marketer Details
                  </h4>
                </div>
                {isMarketerLocked && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200">
                    <Lock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    Sealed
                  </span>
                )}
              </div>

              {isMarketerLocked ? (
                <div
                  role="note"
                  data-testid="marketer-lock-notice"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  <div className="flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                    <span>{MARKETER_LOCK_MESSAGE}</span>
                  </div>
                  <a
                    href={SUPPORT_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Contact Support</span>
                  </a>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verify your brand name, shop mode, hours, and physical address carefully — marketer profile details lock forever once saved.
                </p>
              )}

              <Input
                label="Business / Brand Name"
                name="businessName"
                type="text"
                placeholder="e.g. Deji Tech Ventures or Kemi Thrift Store"
                value={businessName}
                disabled={isMarketerLocked}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  clearFieldError('businessName');
                }}
                error={fieldErrors.businessName}
                helperText={
                  isMarketerLocked
                    ? 'Permanently locked after saving.'
                    : 'Locks permanently once saved.'
                }
                required
              />

              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Do you have a physical shop? <span className="text-red-500">*</span>
                </span>
                <div
                  role="radiogroup"
                  aria-label="Do you have a physical shop?"
                  className="grid grid-cols-2 gap-2.5 max-w-md"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={hasPhysicalShop}
                    disabled={isMarketerLocked}
                    onClick={() => {
                      if (isMarketerLocked) return;
                      setHasPhysicalShop(true);
                      clearFieldError('openingHours');
                      clearFieldError('shopAddress');
                      clearFieldError('gps');
                    }}
                    className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${
                      hasPhysicalShop
                        ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 text-primary-700 dark:text-primary-300 ring-1 ring-primary-500'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Store className="w-4 h-4 shrink-0" />
                    <span>Yes, Physical Shop</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!hasPhysicalShop}
                    disabled={isMarketerLocked}
                    onClick={() => {
                      if (isMarketerLocked) return;
                      setHasPhysicalShop(false);
                      clearFieldError('openingHours');
                      clearFieldError('shopAddress');
                      clearFieldError('gps');
                    }}
                    className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${
                      !hasPhysicalShop
                        ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 text-primary-700 dark:text-primary-300 ring-1 ring-primary-500'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Globe className="w-4 h-4 shrink-0" />
                    <span>No, Online Only</span>
                  </button>
                </div>

                {hasPhysicalShop ? (
                  <div className="pt-3 space-y-5">
                    {/* Opening & Closing Time Pickers (Physical Shop Only) */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                        <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span>
                          Opening &amp; Closing Hours <span className="text-red-500">*</span>
                        </span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label
                            htmlFor="profile-opening-time-start"
                            className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                          >
                            Opening Time
                          </label>
                          <input
                            id="profile-opening-time-start"
                            name="openingTimeStart"
                            type="time"
                            required
                            disabled={isMarketerLocked}
                            value={openingTimeStart}
                            onChange={(e) => {
                              setOpeningTimeStart(e.target.value);
                              clearFieldError('openingHours');
                            }}
                            className="block w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor="profile-opening-time-end"
                            className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                          >
                            Closing Time
                          </label>
                          <input
                            id="profile-opening-time-end"
                            name="openingTimeEnd"
                            type="time"
                            required
                            disabled={isMarketerLocked}
                            value={openingTimeEnd}
                            onChange={(e) => {
                              setOpeningTimeEnd(e.target.value);
                              clearFieldError('openingHours');
                            }}
                            className="block w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                      {formattedHoursPreview && !fieldErrors.openingHours && (
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          Displayed as:{' '}
                          <span className="text-slate-900 dark:text-white">{formattedHoursPreview}</span>
                        </p>
                      )}
                      {fieldErrors.openingHours && (
                        <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
                          {fieldErrors.openingHours}
                        </p>
                      )}
                    </div>

                    <Input
                      label="Physical Shop Address"
                      name="shopAddress"
                      type="text"
                      placeholder="e.g. Shop 12, LASUED Main Gate Complex, Epe"
                      value={shopAddress}
                      disabled={isMarketerLocked}
                      onChange={(e) => {
                        setShopAddress(e.target.value);
                        clearFieldError('shopAddress');
                      }}
                      error={fieldErrors.shopAddress}
                      helperText="Required for marketers with a physical shop."
                      required
                    />

                    <LocationPinField
                      latitude={latitude}
                      longitude={longitude}
                      disabled={isMarketerLocked}
                      onPin={({ latitude: lat, longitude: lng }) => {
                        setLatitude(lat);
                        setLongitude(lng);
                        clearFieldError('gps');
                      }}
                      onClear={() => {
                        setLatitude(undefined);
                        setLongitude(undefined);
                      }}
                      label="Physical Shop GPS Pin"
                      helperText={
                        isMarketerLocked
                          ? 'Shop GPS pin is sealed. Contact Support if your physical shop moved.'
                          : 'Stand at your shop and tap to pin exact GPS coordinates.'
                      }
                      error={fieldErrors.gps}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5">
                    Online Only: Buyers can contact you anytime. Opening/closing hours, physical shop address, and GPS pin are not required.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                    Academic Details
                  </h4>
                </div>
                {anyAcademicLocked && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200">
                    <Lock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    Sealed
                  </span>
                )}
              </div>

              {anyAcademicLocked ? (
                <div
                  role="note"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  <div className="flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                    <span>{ACADEMIC_LOCK_MESSAGE}</span>
                  </div>
                  <a
                    href={SUPPORT_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Contact Support</span>
                  </a>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verify your campus, department, and level carefully — academic
                  fields lock permanently once saved.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select
                  label="Campus"
                  name="campus"
                  placeholder="Select campus"
                  options={campusOptions}
                  value={campus}
                  disabled={isCampusLocked}
                  onChange={(e) => handleCampusChange(e.target.value)}
                  error={fieldErrors.campus}
                  required
                />

                <Input
                  label="Department"
                  name="department"
                  type="text"
                  placeholder="e.g. Computer Science Education"
                  value={department}
                  disabled={isDepartmentLocked}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    clearFieldError('department');
                  }}
                  error={fieldErrors.department}
                  required
                />

                <Select
                  label="Level"
                  name="level"
                  placeholder={campus ? 'Select level' : 'Select campus first'}
                  options={levelOptions}
                  value={level}
                  disabled={isLevelLocked || !campus}
                  onChange={(e) => {
                    setLevel(e.target.value);
                    clearFieldError('level');
                  }}
                  error={fieldErrors.level}
                  helperText={
                    hasGraduated
                      ? 'Graduated — final status forever (no further level upgrades).'
                      : campus === 'LASUED'
                        ? 'LASUED: 100L–400L, then Graduate on Admin session rollover.'
                        : campus === 'LASU'
                          ? 'LASU: 100L–600L, then Graduate on Admin session rollover.'
                          : undefined
                  }
                  required
                />
              </div>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {allEditableFieldsLocked ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All permanent fields are sealed. Only your Phone Number and Profile Picture can be updated once every 7 days.
              </p>
            ) : (
              <span />
            )}
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={saving || allEditableFieldsLocked}
              className="shrink-0 self-end sm:self-auto"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving changes...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Identity Verification Modal */}
      {verifyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-student-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm"
          onClick={() => !submittingVerify && setVerifyModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-5 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <BadgeCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="verify-student-modal-title"
                    className="text-lg font-bold text-slate-900 dark:text-white"
                  >
                    Apply for {isBusinessAccount ? 'Marketer' : 'Student'} Verification
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Earn the {verifiedBadgeLabel} green badge on your profile and listings.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={submittingVerify}
                onClick={() => setVerifyModalOpen(false)}
                aria-label="Close verification modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSubmitVerification(e)}
              className="space-y-4"
            >
              <Select
                label={
                  isBusinessAccount
                    ? 'Select Government / Tangible ID'
                    : 'Select Student Document Type'
                }
                name="verifyDocType"
                options={verificationDocOptions}
                value={verifyDocType}
                onChange={(e) => {
                  setVerifyDocType(e.target.value);
                  setVerifyError(null);
                }}
                required
              />

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  Upload 1 clear photo of your {verifyDocType || 'selected ID'}:
                </p>
                <p>
                  {isBusinessAccount
                    ? 'Marketers must upload a valid NIN Slip/Card, Driver’s License, Voter’s Card, or International Passport matching '
                    : 'Students must upload a Student ID Card or current School Fee Receipt matching '}
                  <span className="font-semibold text-slate-800 dark:text-white">{displayName}</span>.
                </p>
              </div>

              {verifyError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 text-xs font-medium text-red-700 dark:text-red-300"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <span>{verifyError}</span>
                </div>
              )}

              <input
                ref={verifyFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void handleSelectVerifyDocument(e)}
                className="hidden"
              />

              {verifyImageBase64 ? (
                <div className="space-y-2">
                  <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    <img
                      src={verifyImageBase64}
                      alt={`Uploaded ${verifyDocType || 'verification document'} preview`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      disabled={submittingVerify}
                      onClick={() => {
                        setVerifyImageBase64(null);
                        setVerifyImageName('');
                      }}
                      aria-label="Remove uploaded document"
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {verifyImageName && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Selected &amp; compressed: {verifyImageName}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={compressingDoc || submittingVerify}
                  onClick={() => verifyFileInputRef.current?.click()}
                  className="w-full py-10 px-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                >
                  {compressingDoc ? (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-medium">
                        Compressing document...
                      </span>
                    </>
                  ) : (
                    <>
                      <ImagePlus className="w-7 h-7" />
                      <span className="text-sm font-semibold">
                        {isBusinessAccount
                          ? `Upload ${verifyDocType || "NIN / Driver's License"}`
                          : `Upload ${verifyDocType || 'Student ID or Fee Receipt'}`}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        JPG or PNG, automatically compressed for fast review
                      </span>
                    </>
                  )}
                </button>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submittingVerify}
                  onClick={() => setVerifyModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!verifyImageBase64 || compressingDoc || submittingVerify}
                  className="bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500"
                >
                  {submittingVerify ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <BadgeCheck className="w-4 h-4" />
                      <span>Submit for Verification</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
