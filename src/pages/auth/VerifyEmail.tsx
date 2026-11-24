import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Loader2,
  LogOut,
  MailCheck,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LOGO_URL, SITE_NAME } from '../../lib/constants';
import { formatFirebaseAuthError } from '../../lib/authHelpers';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SeoHead } from '../../components/seo/SeoHead';

const RESEND_COOLDOWN_SECONDS = 45;

export function VerifyEmailPage() {
  const {
    user,
    loading,
    isEmailVerified,
    signIn,
    signOut,
    resendVerificationEmail,
    reloadAuthUser,
  } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const stateEmail =
    (location.state as { email?: string; resumed?: boolean } | null)?.email || '';
  const stateResumed = Boolean(
    (location.state as { resumed?: boolean } | null)?.resumed
  );
  const queryEmail = searchParams.get('email') || '';
  const queryPending = searchParams.get('pending') === '1';

  const targetEmail = user?.email || stateEmail || queryEmail;
  const isResumedNotice = stateResumed || queryPending;

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fallback password sign-in when user returned via Signup with an unverified email
  const [unlockEmail, setUnlockEmail] = useState(targetEmail);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    if (targetEmail && !unlockEmail) {
      setUnlockEmail(targetEmail);
    }
  }, [targetEmail, unlockEmail]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (!loading && user && isEmailVerified) {
      navigate('/dashboard/profile', { replace: true });
    }
  }, [loading, user, isEmailVerified, navigate]);

  const handleCheckVerification = async () => {
    if (!user || checking) return;
    setChecking(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const verified = await reloadAuthUser();
      if (verified) {
        showToast(
          'Email verified! Your account is now active — no more email verification needed when posting.',
          'success'
        );
        navigate('/dashboard/profile', { replace: true });
      } else {
        const msg =
          'Your email is not verified yet. Open your Gmail Inbox or Spam folder, click the verification link, then tap this button again.';
        setStatusMessage(msg);
        showToast('Not verified yet — check Inbox & Spam.', 'info');
      }
    } catch (err) {
      const msg = formatFirebaseAuthError(err);
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (!user || resending || cooldownSeconds > 0) return;
    setResending(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await resendVerificationEmail();
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
      const msg =
        'Verification link sent! Please check your Gmail Inbox and Spam / Junk folder.';
      setStatusMessage(msg);
      showToast('Verification email sent! Check Inbox & Spam.', 'success');
    } catch (err) {
      const msg = formatFirebaseAuthError(err);
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setResending(false);
    }
  };

  const handleUnlockVerifySession = async (e: FormEvent) => {
    e.preventDefault();
    if (!unlockEmail.trim() || !unlockPassword) {
      setErrorMessage('Enter your email and password to resume verification.');
      return;
    }
    setUnlocking(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const result = await signIn(unlockEmail, unlockPassword);
      if (result.emailVerified) {
        showToast('Email already verified! Welcome to LASUEDPLUG.', 'success');
        navigate('/dashboard/profile', { replace: true });
        return;
      }
      try {
        await resendVerificationEmail();
        setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
        setStatusMessage(
          'Verification email resent! Check your Gmail Inbox and Spam folder, then tap "I Have Verified My Email".'
        );
      } catch {
        setStatusMessage(
          'Signed in! Check your Gmail Inbox or Spam folder for your verification link.'
        );
      }
    } catch (err) {
      setErrorMessage(formatFirebaseAuthError(err));
    } finally {
      setUnlocking(false);
    }
  };

  const handleSwitchAccount = async () => {
    await signOut();
    navigate('/signup', { replace: true });
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 sm:py-10">
      <SeoHead
        title="Verify Email"
        description="Verify your email address to activate your LASUEDPLUG account."
        noIndex
      />
      <Card hoverable={false} className="p-5 sm:p-7 space-y-4">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2.5">
            <img
              src={LOGO_URL}
              alt={SITE_NAME}
              loading="lazy"
              decoding="async"
              className="h-8 w-auto object-contain"
            />
            <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <MailCheck className="w-4 h-4" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Verify your email to activate
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {isResumedNotice
              ? 'You are not done with email verification yet. Verify your email once to activate your account so you will not need Gmail verification again when uploading items or services.'
              : 'We sent an activation link to your email. Verify once now — you will not be asked for email verification again when uploading items or services.'}
          </p>
        </div>

        {user && targetEmail && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-center">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Account Email
            </span>
            <span className="block text-sm font-bold text-slate-900 dark:text-white break-all">
              {targetEmail}
            </span>
          </div>
        )}

        <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 p-3.5 space-y-1 text-xs sm:text-sm text-amber-950 dark:text-amber-100">
          <p className="font-semibold flex items-center gap-2">
            <Inbox className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <span>Check both your Gmail Inbox and Spam folder</span>
          </p>
          <p className="text-amber-900 dark:text-amber-200 leading-relaxed">
            Sometimes verification emails land in <strong>Spam</strong> or{' '}
            <strong>Promotions</strong>. Open the email from {SITE_NAME}, tap the
            verification link, and return here to activate.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 text-xs sm:text-sm text-red-700 dark:text-red-300"
          >
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {statusMessage && (
          <div
            role="status"
            className="flex items-start gap-2.5 p-3.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 text-xs sm:text-sm text-blue-900 dark:text-blue-200"
          >
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <span>{statusMessage}</span>
          </div>
        )}

        {user ? (
          <div className="space-y-3">
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              disabled={checking}
              onClick={() => void handleCheckVerification()}
            >
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking verification...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>I Have Verified My Email</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="md"
              fullWidth
              disabled={resending || cooldownSeconds > 0}
              onClick={() => void handleResend()}
            >
              {resending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending link...</span>
                </>
              ) : cooldownSeconds > 0 ? (
                <span>Resend Email ({cooldownSeconds}s)</span>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Resend Verification Email</span>
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={() => void handleSwitchAccount()}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Wrong email? Sign out and register again</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleUnlockVerifySession} className="space-y-4">
            <Input
              label="Email Address"
              name="unlockEmail"
              type="email"
              value={unlockEmail}
              onChange={(e) => setUnlockEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <Input
              label="Your Password"
              name="unlockPassword"
              type="password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              placeholder="Enter the password you registered with"
              required
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={unlocking}
            >
              {unlocking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking account...</span>
                </>
              ) : (
                <span>Continue &amp; Resend Verification Email</span>
              )}
            </Button>
            <p className="text-center text-xs text-slate-600 dark:text-slate-400">
              Already clicked the link in your email?{' '}
              <Link to="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                Log in here
              </Link>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
