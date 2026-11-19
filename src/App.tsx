import { AuthProvider } from './contexts/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { AppRouter } from './router';

export function App() {
  return (
    <AuthProvider>
      <AppShell>
        <AppRouter />
      </AppShell>
    </AuthProvider>
  );
}

export default App;
