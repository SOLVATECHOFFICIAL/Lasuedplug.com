import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getProtectedRouteDecision } from '../../lib/authHelpers';
import { Loading } from '../feedback/Loading';

interface ProtectedRouteProps {
  children: ReactNode;
  requireCompleteProfile?: boolean;
}

export function ProtectedRoute({
  children,
  requireCompleteProfile = false,
}: ProtectedRouteProps) {
  const { user, loading, isProfileComplete } = useAuth();
  const location = useLocation();

  const decision = getProtectedRouteDecision({
    loading,
    isAuthenticated: Boolean(user),
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
