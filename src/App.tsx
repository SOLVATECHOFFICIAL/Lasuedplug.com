import { AuthProvider } from './contexts/AuthContext';
import { PWAProvider } from './contexts/PWAContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { AppShell } from './components/layout/AppShell';
import { AppRouter } from './router';

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <PWAProvider>
          <AuthProvider>
            <AppShell>
              <AppRouter />
            </AppShell>
          </AuthProvider>
        </PWAProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
