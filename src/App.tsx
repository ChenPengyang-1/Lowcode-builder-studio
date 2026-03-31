import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { EditorShell } from './components/EditorShell';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PublishedPage } from './pages/PublishedPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  clearAuthSession,
  getStoredAuthSession,
  persistAuthSession,
  type AuthSession,
} from './utils/auth';
import { getStoredThemeMode, persistThemeMode, type ThemeMode } from './utils/theme';

type AppRoute = 'dashboard' | 'editor' | 'published' | 'settings';

function renderProtectedRoute(
  authSession: AuthSession | null,
  themeMode: ThemeMode,
  handleLogout: () => void,
  handleThemeChange: (mode: ThemeMode) => void,
) {
  if (!authSession) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ProtectedApp
      authSession={authSession}
      themeMode={themeMode}
      onLogout={handleLogout}
      onThemeChange={handleThemeChange}
    />
  );
}

function getRouteFromPath(pathname: string): AppRoute | 'login' {
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/published')) return 'published';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/login')) return 'login';
  return 'editor';
}

function ProtectedApp({
  authSession,
  themeMode,
  onLogout,
  onThemeChange,
}: {
  authSession: AuthSession;
  themeMode: ThemeMode;
  onLogout: () => void;
  onThemeChange: (mode: ThemeMode) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const route = getRouteFromPath(location.pathname) as AppRoute;

  const handleToggleTheme = () => {
    onThemeChange(themeMode === 'dark' ? 'light' : 'dark');
  };

  const handleNavigate = (nextRoute: AppRoute) => {
    navigate(`/${nextRoute}`);
  };

  const content = useMemo(() => {
    if (route === 'dashboard') {
      return <DashboardPage onNavigate={handleNavigate} />;
    }

    if (route === 'published') {
      return <PublishedPage currentUser={authSession} />;
    }

    if (route === 'settings') {
      return (
        <SettingsPage
          currentUser={authSession}
          themeMode={themeMode}
          onThemeChange={onThemeChange}
        />
      );
    }

    return <EditorShell />;
  }, [authSession, onThemeChange, route, themeMode]);

  return (
    <AppShell
      route={route}
      currentUser={authSession}
      onLogout={onLogout}
      onNavigate={handleNavigate}
      themeMode={themeMode}
      onToggleTheme={handleToggleTheme}
    >
      {content}
    </AppShell>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const route = getRouteFromPath(location.pathname);
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getStoredAuthSession());
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());

  useEffect(() => {
    document.body.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (route !== 'login' && !authSession) {
      navigate('/login', { replace: true });
    }
  }, [authSession, navigate, route]);

  const handleLogin = (session: AuthSession, remember: boolean) => {
    persistAuthSession(session, remember);
    setAuthSession(session);
    navigate('/dashboard', { replace: true });
  };

  const handleLogout = () => {
    clearAuthSession();
    setAuthSession(null);
    navigate('/login', { replace: true });
  };

  const handleThemeChange = (mode: ThemeMode) => {
    persistThemeMode(mode);
    setThemeMode(mode);
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage onLogin={handleLogin} />}
      />
      <Route path="/dashboard" element={renderProtectedRoute(authSession, themeMode, handleLogout, handleThemeChange)} />
      <Route path="/editor" element={renderProtectedRoute(authSession, themeMode, handleLogout, handleThemeChange)} />
      <Route path="/published" element={renderProtectedRoute(authSession, themeMode, handleLogout, handleThemeChange)} />
      <Route path="/settings" element={renderProtectedRoute(authSession, themeMode, handleLogout, handleThemeChange)} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
