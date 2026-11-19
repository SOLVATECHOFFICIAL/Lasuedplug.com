import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { MobileNav } from './MobileNav';
import { ToastProvider } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, loading, isProfileComplete } = useAuth();
  const showIncompleteBanner = !loading && Boolean(user) && !isProfileComplete;

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
        <Navbar />
        {showIncompleteBanner && (
          <div
            role="alert"
            className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center text-xs sm:text-sm font-medium text-amber-900"
          >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Complete your profile to start buying and selling.{' '}
                <Link
                  to="/dashboard/profile"
                  className="font-semibold underline underline-offset-2 text-amber-950 hover:text-blue-700"
                >
                  Go to Profile.
                </Link>
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 w-full">{children}</main>
        <Footer />
        <MobileNav />
      </div>
    </ToastProvider>
  );
}
