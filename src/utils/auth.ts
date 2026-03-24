export interface AuthSession {
  account: string;
  displayName: string;
  role: string;
  loginAt: string;
}

const SESSION_KEY = 'lowcode_builder_auth_session_v1';
const REMEMBER_KEY = 'lowcode_builder_auth_remember_v1';

const DEMO_ACCOUNTS = [
  {
    account: 'admin',
    password: 'Builder2026!',
    displayName: '产品搭建负责人',
    role: 'Admin',
  },
  {
    account: 'demo@studio.com',
    password: 'Builder2026!',
    displayName: '模板运营同学',
    role: 'Operator',
  },
];

export function authenticateDemoUser(account: string, password: string): AuthSession | null {
  const normalized = account.trim().toLowerCase();
  const matched = DEMO_ACCOUNTS.find(
    (item) => item.account.toLowerCase() === normalized && item.password === password,
  );

  if (!matched) {
    return null;
  }

  return {
    account: matched.account,
    displayName: matched.displayName,
    role: matched.role,
    loginAt: new Date().toISOString(),
  };
}

export function getStoredAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const remembered = window.localStorage.getItem(REMEMBER_KEY);
  const raw = remembered
    ? window.localStorage.getItem(SESSION_KEY)
    : window.sessionStorage.getItem(SESSION_KEY) ?? window.localStorage.getItem(SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function persistAuthSession(session: AuthSession, remember: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  clearAuthSession();

  if (remember) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.localStorage.setItem(REMEMBER_KEY, '1');
    return;
  }

  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(REMEMBER_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
}
