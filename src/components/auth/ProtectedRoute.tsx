import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getProtectedRouteDecision } from '../../lib/authHelpers';
import { Loading } from '../feedback/Loading';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
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

  return <>{children}</>;
}
