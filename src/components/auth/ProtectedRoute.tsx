import { ReactNode, useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getProtectedRouteDecision,
  SUSPENDED_ACCOUNT_MESSAGE,
} from '../../lib/authHelpers';
import { Loading } from '../feedback/Loading';

interface ProtectedRouteProps {
  children: ReactNode;
  requireCompleteProfile?: boolean;
}

export function ProtectedRoute({
  children,
  requireCompleteProfile = false,
}: ProtectedRouteProps) {
  const { user, loading, isProfileComplete, isSuspended, signOut } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const handledSuspensionRef = useRef(false);

  useEffect(() => {
    if (!loading && isSuspended && !handledSuspensionRef.current) {
      handledSuspensionRef.current = true;
      showToast(SUSPENDED_ACCOUNT_MESSAGE, 'error');
      void signOut();
    }
    if (!isSuspended) {
      handledSuspensionRef.current = false;
    }
  }, [loading, isSuspended, signOut, showToast]);

  const decision = getProtectedRouteDecision({
    loading,
    isAuthenticated: Boolean(user),
    isSuspended,
  });

  if (decision === 'loading') {
    return <Loading fullScreen message="Checking session..." />;
  }

  if (decision === 'redirect') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (
    requireCompleteProfile &&
    !isProfileComplete &&
    location.pathname !== '/dashboard/profile'
  ) {
    return (
      <Navigate
        to="/dashboard/profile"
        state={{
          from: location,
          toastMessage: 'Please complete your profile to post a listing.',
        }}
        replace
      />
    );
  }

  return <>{children}</>;
}
