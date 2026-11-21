import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
import { PWAProvider } from './contexts/PWAContext';
import { ToastProvider } from './contexts/ToastContext';
import { AppShell } from './components/layout/AppShell';
import { AppRouter } from './router';

export function App() {
  return (
    <HelmetProvider>
      <ToastProvider>
        <PWAProvider>
          <AuthProvider>
            <AppShell>
              <AppRouter />
            </AppShell>
          </AuthProvider>
        </PWAProvider>
      </ToastProvider>
    </HelmetProvider>
  );
}

export default App;
