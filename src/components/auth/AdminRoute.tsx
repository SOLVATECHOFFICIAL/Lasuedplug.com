import { ReactNode, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { isUserAdmin } from '../../lib/adminHelpers';
import { Loading } from '../feedback/Loading';

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, profile, loading } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const [checkingClaims, setCheckingClaims] = useState(true);
  const [hasAdminClaim, setHasAdminClaim] = useState(false);
  const deniedToastShownRef = useRef(false);

  useEffect(() => {
    let active = true;

    if (loading) {
      return;
    }

    if (!user) {
      setHasAdminClaim(false);
      setCheckingClaims(false);
      return;
    }

    if (profile?.roles?.admin === true) {
      setHasAdminClaim(true);
      setCheckingClaims(false);
      return;
    }

    setCheckingClaims(true);
    user
      .getIdTokenResult()
      .then((result) => {
        if (active) {
          setHasAdminClaim(result.claims?.admin === true);
        }
      })
      .catch(() => {
        if (active) {
          setHasAdminClaim(false);
        }
      })
      .finally(() => {
        if (active) {
          setCheckingClaims(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user, profile?.roles?.admin, loading]);

  const authorized = isUserAdmin(profile, hasAdminClaim);

  useEffect(() => {
    if (!loading && !checkingClaims && user && !authorized && !deniedToastShownRef.current) {
      deniedToastShownRef.current = true;
      showToast('Admin access required.', 'error');
    }
  }, [loading, checkingClaims, user, authorized, showToast]);

  if (loading || (user && checkingClaims)) {
    return <Loading fullScreen message="Verifying admin access..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!authorized) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
