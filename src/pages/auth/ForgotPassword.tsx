import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { LOGO_URL, SITE_NAME } from '../../lib/constants';
import {
  formatFirebaseAuthError,
  validateEmailField,
} from '../../lib/authHelpers';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const validationError = validateEmailField(email);
    setEmailError(validationError);
    if (validationError) {
      return;
    }

    if (!auth) {
      setFormError('Firebase is not configured. Check .env.local.');
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMessage(
        'If an account exists, a reset link has been sent to your email.'
      );
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/user-not-found') {
        setSuccessMessage(
          'If an account exists, a reset link has been sent to your email.'
        );
      } else {
        setFormError(formatFirebaseAuthError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10 sm:py-14">
      <Card hoverable={false} className="p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <img
            src={LOGO_URL}
            alt={SITE_NAME}
            className="h-12 w-auto mx-auto object-contain"
          />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Reset your password
          </h1>
          <p className="text-sm text-slate-600">
            Enter your email address and we will send you a password reset link.
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

        {successMessage && (
          <div
            role="status"
            className="flex items-start gap-2.5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
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
              if (emailError) setEmailError(undefined);
            }}
            error={emailError}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={submitting}
          >
            <Mail className="w-4 h-4" />
            {submitting ? 'Sending link...' : 'Send Reset Link'}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-600">
          Remembered your password?{' '}
          <Link
            to="/login"
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            Back to Login
          </Link>
        </p>
      </Card>
    </div>
  );
}
