import { ReactNode, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import { MailCheck, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  isAuthorizedAdminEmail,
  isAuthorizedAdminSession,
  isUserAdmin,
  PRIMARY_ADMIN_EMAIL,
} from '../../lib/adminHelpers';
import { Loading } from '../feedback/Loading';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, profile, loading } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const [sendingVerification, setSendingVerification] = useState(false);
  const [reloadingUser, setReloadingUser] = useState(false);
  const [verifiedConfirmed, setVerifiedConfirmed] = useState(false);
  const deniedToastShownRef = useRef(false);

  const isAdminEmail = isAuthorizedAdminEmail(user?.email);
  const hasAdminRole = isUserAdmin(profile);
  const canAccessAdmin = isAdminEmail || hasAdminRole;
  const isAdminVerified =
    hasAdminRole || verifiedConfirmed || isAuthorizedAdminSession(user);

  useEffect(() => {
    setVerifiedConfirmed(
      Boolean(
        hasAdminRole || (user && isAuthorizedAdminSession(user))
      )
    );
    if (user && canAccessAdmin) {
      void user.getIdToken(true).catch(() => {});
    }
  }, [hasAdminRole, canAccessAdmin, user, user?.emailVerified]);

  useEffect(() => {
    if (!loading && user && !canAccessAdmin && !deniedToastShownRef.current) {
      deniedToastShownRef.current = true;
      showToast('Admin access required.', 'error');
    }
  }, [loading, user, canAccessAdmin, showToast]);

  if (loading) {
    return <Loading fullScreen message="Verifying admin access..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!canAccessAdmin) {
    return <Navigate to="/" replace />;
  }

  if (!isAdminVerified) {
    const handleSendVerification = async () => {
      if (sendingVerification) return;
      setSendingVerification(true);
      try {
        await sendEmailVerification(user);
        showToast(
          `Verification link sent to ${user.email || PRIMARY_ADMIN_EMAIL}. Check your inbox or spam folder.`,
          'success'
        );
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : 'Unable to send verification email right now.',
          'error'
        );
      } finally {
        setSendingVerification(false);
      }
    };

    const handleCheckVerified = async () => {
      if (reloadingUser) return;
      setReloadingUser(true);
      try {
        await user.reload();
        await user.getIdToken(true);
        if (user.emailVerified) {
          setVerifiedConfirmed(true);
          showToast('Admin email verified. Welcome!', 'success');
        } else {
          showToast(
            'Email is not verified yet. Click the link in your inbox first.',
            'info'
          );
        }
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : 'Unable to refresh verification status.',
          'error'
        );
      } finally {
        setReloadingUser(false);
      }
    };

    return (
      <div className="max-w-md w-full mx-auto px-4 py-12">
        <Card hoverable={false} className="space-y-5 text-center p-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Verify Admin Email
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              For maximum security, only a verified{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {user.email || PRIMARY_ADMIN_EMAIL}
              </span>{' '}
              session can access the Admin Console.
            </p>
          </div>
          <div className="space-y-2.5 pt-1">
            <Button
              variant="primary"
              size="md"
              fullWidth
              disabled={sendingVerification}
              onClick={() => void handleSendVerification()}
            >
              <MailCheck className="w-4 h-4" />
              <span>
                {sendingVerification
                  ? 'Sending Email...'
                  : 'Send Verification Email'}
              </span>
            </Button>
            <Button
              variant="outline"
              size="md"
              fullWidth
              disabled={reloadingUser}
              onClick={() => void handleCheckVerified()}
            >
              <RefreshCw
                className={`w-4 h-4 ${reloadingUser ? 'animate-spin' : ''}`}
              />
              <span>
                {reloadingUser
                  ? 'Checking...'
                  : "I've Verified — Refresh Access"}
              </span>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
