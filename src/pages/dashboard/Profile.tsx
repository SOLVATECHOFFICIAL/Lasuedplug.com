import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  GraduationCap,
  ImagePlus,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  ACADEMIC_LOCK_MESSAGE,
  ADMIN_WHATSAPP_NUMBER,
  getFieldCooldownStatus,
  getInitials,
  getPrimaryRoleLabel,
  isAcademicFieldLocked,
  NAME_LOCK_MESSAGE,
  PHONE_UPDATE_COOLDOWN_DAYS,
} from '../../lib/authHelpers';
import { buildAdminWhatsAppUrl } from '../../lib/marketplaceHelpers';
import {
  CAMPUS_OPTIONS,
  getLevelsForCampus,
  handleCampusCascade,
} from '../../lib/academicData';
import { compressImageToBase64, isImageFile } from '../../lib/imageUtils';
import { getVerificationUiState } from '../../lib/verificationHelpers';
import {
  getUserVerificationRequests,
  submitVerificationRequest,
} from '../../lib/verificationService';
import { VerificationRequest } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';

interface FieldErrors {
  fullName?: string;
  phone?: string;
  campus?: string;
  department?: string;
  level?: string;
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
  const { user, profile, isProfileComplete, updateUserProfile } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const shownRedirectToastRef = useRef<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [campus, setCampus] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Student Verification workflow state
  const [verificationRequests, setVerificationRequests] = useState<
    VerificationRequest[]
  >([]);
  const [loadingVerification, setLoadingVerification] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
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

  const isNameLocked = isAcademicFieldLocked(profile?.fullName);
  const isCampusLocked = isAcademicFieldLocked(profile?.campus);
  const isDepartmentLocked = isAcademicFieldLocked(profile?.department);
  const isLevelLocked = isAcademicFieldLocked(profile?.level);
  const anyAcademicLocked =
    isCampusLocked || isDepartmentLocked || isLevelLocked;

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
  const initials = getInitials(displayName, email);
  const roleLabel = getPrimaryRoleLabel(profile?.roles);
  const isVerified = Boolean(profile?.isVerified);
  const verificationUiState = useMemo(
    () => getVerificationUiState(isVerified, verificationRequests),
    [isVerified, verificationRequests]
  );
  const adminWhatsAppUrl = buildAdminWhatsAppUrl(
    ADMIN_WHATSAPP_NUMBER,
    email,
    displayName
  );

  const allEditableFieldsLocked =
    isNameLocked &&
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
    if (!campus.trim()) {
      errors.campus = 'Please select your campus.';
    }
    if (!department.trim() || department.trim().length < 2) {
      errors.department = 'Please enter your department.';
    }
    if (!level.trim()) {
      errors.level = 'Please select your level.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile({
        fullName,
        phone,
        campus,
        department,
        level,
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

  const handleOpenVerifyModal = () => {
    setVerifyError(null);
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

    if (!verifyImageBase64) {
      setVerifyError('Please upload your Student ID card or School Fee receipt.');
      return;
    }

    setVerifyError(null);
    setSubmittingVerify(true);
    try {
      const created = await submitVerificationRequest({
        userId: user.uid,
        fullName: displayName,
        idCardImage: verifyImageBase64,
      });
      setVerificationRequests((prev) => [created, ...prev]);
      setVerifyModalOpen(false);
      setVerifyImageBase64(null);
      setVerifyImageName('');
      showToast(
        'Verification request submitted! An Admin will review your document shortly.',
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
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          My Profile
        </h1>
        <p className="text-sm text-slate-600">
          Manage your personal details and sealed campus academic record.
        </p>
      </div>

      {/* Profile Overview Card */}
      <Card
        hoverable={false}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-5"
      >
        <div className="flex items-center gap-4 min-w-0">
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={displayName}
              loading="lazy"
              className="w-16 h-16 rounded-full object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary-500 text-white text-xl font-bold flex items-center justify-center shrink-0">
              {initials}
            </div>
          )}

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 truncate">
                {displayName}
              </h2>
              {isVerified && (
                <BadgeCheck
                  className="w-5 h-5 text-emerald-600 shrink-0"
                  aria-label="Verified Student"
                />
              )}
            </div>
            <p className="text-sm text-slate-500 flex items-center gap-1.5 truncate">
              <Mail className="w-4 h-4 shrink-0" />
              <span className="truncate">{email}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="role">{roleLabel}</Badge>
              {isVerified ? (
                <Badge variant="verified">
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Verified Student
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
            {!isVerified && verificationUiState === 'pending' && (
              <p className="text-xs text-amber-700 pt-0.5">
                Your verification document is awaiting Admin approval.
              </p>
            )}
            {!isVerified && verificationUiState === 'rejected' && (
              <p className="text-xs text-red-600 pt-0.5">
                Your previous submission was rejected. Upload a clearer ID or fee receipt to reapply.
              </p>
            )}
          </div>
        </div>

        {!isVerified && verificationUiState !== 'pending' && (
          <div className="shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingVerification}
              onClick={handleOpenVerifyModal}
              className="border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
            >
              <BadgeCheck className="w-4 h-4" />
              <span>Apply for Verification</span>
            </Button>
          </div>
        )}
      </Card>

      {/* Edit Profile Form */}
      <Card hoverable={false} className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Edit Profile Details
          </h3>
          <p className="text-sm text-slate-500">
            Complete all fields below to unlock buying, selling, and messaging on
            LASUEDPLUG.
          </p>
        </div>

        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {savedNotice && (
          <div
            role="status"
            className="flex items-start gap-2.5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{savedNotice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
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

          {/* Sealed Academic Details */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary-600" />
                <h4 className="text-base font-semibold text-slate-900">
                  Academic Details
                </h4>
              </div>
              {anyAcademicLocked && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  Sealed
                </span>
              )}
            </div>

            {anyAcademicLocked ? (
              <div
                role="note"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-700"
              >
                <div className="flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>{ACADEMIC_LOCK_MESSAGE}</span>
                </div>
                <a
                  href={adminWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Admin</span>
                </a>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
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
                  campus === 'LASUED'
                    ? 'LASUED levels range from 100L to 400L.'
                    : campus === 'LASU'
                      ? 'LASU levels range from 100L to 600L.'
                      : undefined
                }
                required
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={saving || allEditableFieldsLocked}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving changes...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Student Verification Modal */}
      {verifyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-student-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => !submittingVerify && setVerifyModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <BadgeCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="verify-student-modal-title"
                    className="text-lg font-bold text-slate-900"
                  >
                    Apply for Verification
                  </h2>
                  <p className="text-xs text-slate-500">
                    Earn the Verified Student green badge on your profile and listings.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={submittingVerify}
                onClick={() => setVerifyModalOpen(false)}
                aria-label="Close verification modal"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSubmitVerification(e)}
              className="space-y-4"
            >
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">
                  Upload 1 clear photo of your:
                </p>
                <p>
                  Student ID Card or current School Fee Receipt showing your name (
                  <span className="font-semibold text-slate-800">{displayName}</span>
                  ).
                </p>
              </div>

              {verifyError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
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
                  <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                    <img
                      src={verifyImageBase64}
                      alt="Uploaded student ID or fee receipt preview"
                      loading="lazy"
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
                    <p className="text-xs text-slate-500 truncate">
                      Selected &amp; compressed: {verifyImageName}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={compressingDoc || submittingVerify}
                  onClick={() => verifyFileInputRef.current?.click()}
                  className="w-full py-10 px-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/40 flex flex-col items-center justify-center gap-2 text-slate-600 hover:text-emerald-700 transition-colors"
                >
                  {compressingDoc ? (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
                      <span className="text-sm font-medium">
                        Compressing document...
                      </span>
                    </>
                  ) : (
                    <>
                      <ImagePlus className="w-7 h-7" />
                      <span className="text-sm font-semibold">
                        Upload Student ID or School Fee Receipt
                      </span>
                      <span className="text-xs text-slate-400">
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
