import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Building2, GraduationCap, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LOGO_URL, SITE_NAME } from '../../lib/constants';
import {
  formatFirebaseAuthError,
  SignupFormErrors,
  validateSignupForm,
} from '../../lib/authHelpers';
import { AccountType } from '../../types';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SeoHead } from '../../components/seo/SeoHead';

export function SignupPage() {
  const [accountType, setAccountType] = useState<AccountType>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SignupFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { signUp } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const errors = validateSignupForm({
      fullName,
      email,
      password,
      confirmPassword,
    });
    setFieldErrors(errors);

    if (!agreedToTerms) {
      const termsError =
        'Please check the Terms box to agree to our Terms of Service, Privacy Policy, and Safety Rules.';
      setFormError(termsError);
      showToast('Please check the Terms box to continue.', 'error');
      return;
    }

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUp(email, password, fullName, accountType);
      if (result.status === 'unverified_resumed') {
        showToast(
          'You are not done verifying your email! Check your Inbox or Spam folder to activate your account.',
          'info'
        );
      } else {
        showToast(
          'Account created! Check your Gmail Inbox or Spam folder to verify and activate your account.',
          'success'
        );
      }
      navigate('/verify-email', {
        state: {
          email: email.trim().toLowerCase(),
          resumed: result.status === 'unverified_resumed',
        },
      });
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      if (code === 'auth/email-unverified-resume') {
        const normalizedEmail = email.trim().toLowerCase();
        showToast(
          'You are not done with email verification. Taking you to verify and activate your account.',
          'info'
        );
        navigate(
          `/verify-email?email=${encodeURIComponent(normalizedEmail)}&pending=1`,
          {
            state: { email: normalizedEmail, resumed: true },
          }
        );
        return;
      }
      setFormError(formatFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10 sm:py-14">
      <SeoHead
        title="Create Account"
        description="Join LASUED, LASU, and Epe students buying, selling, and discovering campus services on LASUEDPLUG."
      />
      <Card hoverable={false} className="p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <img
            src={LOGO_URL}
            alt={SITE_NAME}
            loading="lazy"
            decoding="async"
            className="h-12 w-auto mx-auto object-contain"
          />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Create your account
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Join LASUED, LASU, and Epe students buying and selling on campus.
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

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label="Full Name"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="e.g. Ada Okafor"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (fieldErrors.fullName) {
                setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
              }
            }}
            error={fieldErrors.fullName}
            required
          />

          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Account Type
            </span>
            <div
              role="radiogroup"
              aria-label="Account Type"
              className="grid grid-cols-2 gap-2.5"
            >
              <button
                type="button"
                role="radio"
                aria-checked={accountType === 'student'}
                onClick={() => setAccountType('student')}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all duration-200 ${
                  accountType === 'student'
                    ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 text-primary-700 dark:text-primary-300 ring-1 ring-primary-500'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <GraduationCap className="w-4 h-4 shrink-0" />
                <span>I am a Student</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={accountType === 'business'}
                onClick={() => setAccountType('business')}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all duration-200 ${
                  accountType === 'business'
                    ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 text-primary-700 dark:text-primary-300 ring-1 ring-primary-500'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span>I am a Marketer</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 rounded-lg px-3 py-2 leading-relaxed">
              {accountType === 'business'
                ? 'Marketer account: Physical shops set opening/closing hours, address & GPS pin (online marketers can be contacted anytime). Verify identity with NIN, Driver’s License, Voter’s Card, or Passport.'
                : 'Student account: Complete your campus academic details and verify with your Student ID Card or School Fee Receipt.'}{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Choose carefully — this can only be selected once at signup unless Admin changes it for you.
              </span>
            </p>
          </div>

          <Input
            label="Email Address"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) {
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
            error={fieldErrors.email}
            required
          />

          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) {
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            error={fieldErrors.password}
            required
          />

          <Input
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (fieldErrors.confirmPassword) {
                setFieldErrors((prev) => ({
                  ...prev,
                  confirmPassword: undefined,
                }));
              }
            }}
            error={fieldErrors.confirmPassword}
            required
          />

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 p-3.5">
            <label
              htmlFor="signup-legal-agreement"
              className="flex items-start gap-3 cursor-pointer select-none"
            >
              <input
                id="signup-legal-agreement"
                name="agreedToTerms"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => {
                  setAgreedToTerms(e.target.checked);
                  if (e.target.checked && formError) {
                    setFormError(null);
                  }
                }}
                className="mt-0.5 h-5 w-5 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-primary-600 focus:ring-primary-500 shrink-0 cursor-pointer"
                required
              />
              <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                I agree to the{' '}
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2"
                >
                  Terms of Service
                </Link>
                ,{' '}
                <Link
                  to="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2"
                >
                  Privacy Policy
                </Link>
                , and{' '}
                <Link
                  to="/safety"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2"
                >
                  Safety Rules
                </Link>
                . I understand that LASUEDPLUG is not responsible for offline
                transactions or scams.
              </span>
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={submitting}
          >
            <UserPlus className="w-4 h-4" />
            {submitting ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
