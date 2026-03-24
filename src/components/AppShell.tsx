import type { ReactNode } from 'react';
import type { AuthSession } from '../utils/auth';
import type { ThemeMode } from '../utils/theme';

type AppRoute = 'dashboard' | 'editor' | 'published' | 'settings';

interface AppShellProps {
  route: AppRoute;
  currentUser: AuthSession;
  onLogout: () => void;
  onNavigate: (route: AppRoute) => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  children: ReactNode;
}

const navItems: Array<{
  key: AppRoute;
  label: string;
  eyebrow: string;
}> = [
  { key: 'dashboard', label: '工作台', eyebrow: 'Overview' },
  { key: 'editor', label: '页面编辑器', eyebrow: 'Builder' },
  { key: 'published', label: '模板发布', eyebrow: 'Templates' },
  { key: 'settings', label: '系统设置', eyebrow: 'Config' },
];

const routeMeta: Record<AppRoute, { title: string }> = {
  dashboard: {
    title: '工作台',
  },
  editor: {
    title: '页面编辑器',
  },
  published: {
    title: '模板发布',
  },
  settings: {
    title: '系统设置',
  },
};

export function AppShell({
  route,
  currentUser,
  onLogout,
  onNavigate,
  themeMode,
  onToggleTheme,
  children,
}: AppShellProps) {
  const meta = routeMeta[route];

  return (
    <div className={`app-shell theme-${themeMode}`}>
      <aside className="app-sidebar">
        <div className="app-brand">
          <div className="app-brand-badge">LC</div>
          <div>
            <div className="app-brand-title">低代码页面平台</div>
            <div className="app-brand-subtitle">React + TypeScript 项目</div>
          </div>
        </div>

        <nav className="app-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`app-nav-item ${route === item.key ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
            >
              <span>{item.eyebrow}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </nav>

        <div className="app-sidebar-foot">
          <div className="app-side-note">
            <strong>当前账号</strong>
            <span>{currentUser.displayName}</span>
          </div>
          <div className="app-side-note">
            <strong>角色</strong>
            <span>{currentUser.role}</span>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div>
            <div className="app-header-tag">{navItems.find((item) => item.key === route)?.eyebrow}</div>
            <h1>{meta.title}</h1>
          </div>

          <div className="app-header-actions">
            <button
              type="button"
              className={`theme-switch ${themeMode === 'light' ? 'light' : 'dark'}`}
              onClick={onToggleTheme}
              aria-label="切换主题"
            >
              <span className="theme-switch-track">
                <span className="theme-switch-icon sun">☀</span>
                <span className="theme-switch-icon moon">☾</span>
                <span className="theme-switch-thumb" />
              </span>
            </button>
            <button type="button" className="app-header-ghost" onClick={onLogout}>
              退出登录
            </button>
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
