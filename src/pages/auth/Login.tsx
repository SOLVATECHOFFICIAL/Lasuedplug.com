import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { LOGO_URL, SITE_NAME } from '../../lib/constants';
import {
  formatFirebaseAuthError,
  LoginFormErrors,
  validateLoginForm,
} from '../../lib/authHelpers';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SeoHead } from '../../components/seo/SeoHead';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { signIn } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ||
    '/';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const errors = validateLoginForm({ email, password });
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const { emailVerified } = await signIn(email, password);
      if (!emailVerified) {
        showToast(
          'You are not done verifying your email. Check your Inbox or Spam folder to activate your account.',
          'info'
        );
        navigate('/verify-email', {
          replace: true,
          state: { email: email.trim().toLowerCase(), resumed: true },
        });
        return;
      }
      showToast('Signed in successfully.', 'success');
      navigate(fromPath === '/login' ? '/' : fromPath, { replace: true });
    } catch (err) {
      setFormError(formatFirebaseAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10 sm:py-14">
      <SeoHead
        title="Log In"
        description="Log in to LASUEDPLUG to manage your listings, messages, and campus profile."
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
            Welcome back
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Log in to manage your listings, messages, and profile.
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

          <div className="space-y-1.5">
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
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
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={submitting}
          >
            <LogIn className="w-4 h-4" />
            {submitting ? 'Logging in...' : 'Log In'}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          New to {SITE_NAME}?{' '}
          <Link
            to="/signup"
            className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Create an account
          </Link>
        </p>
      </Card>
    </div>
  );
}
