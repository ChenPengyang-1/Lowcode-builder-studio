import { useState, type FormEvent } from 'react';
import { authenticateDemoUser, type AuthSession } from '../utils/auth';

interface LoginPageProps {
  onLogin: (session: AuthSession, remember: boolean) => void;
}

type ActiveField = 'account' | 'password' | null;

function getMascotState(activeField: ActiveField, showPassword: boolean) {
  if (activeField === 'account') return 'look-account';
  if (activeField === 'password' && !showPassword) return 'guard-password';
  if (activeField === 'password' && showPassword) return 'look-password';
  return 'idle';
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [account, setAccount] = useState('admin');
  const [password, setPassword] = useState('Builder2026!');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const mascotState = getMascotState(activeField, showPassword);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!account.trim() || !password.trim()) {
      setError('请输入账号和密码后再登录。');
      return;
    }

    const session = authenticateDemoUser(account, password);
    if (!session) {
      setError('账号或密码不正确。可使用演示账号 `admin / Builder2026!`。');
      return;
    }

    setError('');
    setSubmitting(true);

    window.setTimeout(() => {
      onLogin(session, remember);
      setSubmitting(false);
    }, 720);
  };

  return (
    <div className={`login-page ${activeField ? `focus-${activeField}` : ''}`}>
      <div className="login-ambient login-ambient-a" />
      <div className="login-ambient login-ambient-b" />

      <div className="login-shell">
        <section className="login-brand-panel">
          <div className="login-panel-label">Project Login</div>
          <h1>低代码页面搭建平台</h1>

          <div className={`login-orbit login-orbit-${mascotState}`}>
            <div className="login-orbit-ring" />
            <div className="login-orbit-ring secondary" />
            <div className="login-mascot">
              <div className="login-mascot-halo" />
              <div className="login-mascot-head">
                <div className="login-mascot-eyes">
                  <span className="eye">
                    <i />
                  </span>
                  <span className="eye">
                    <i />
                  </span>
                </div>
              </div>
              <div className="login-mascot-body" />
            </div>
          </div>

          <div className="login-metrics">
            <div>
              <strong>Schema</strong>
              <span>页面结构存储</span>
            </div>
            <div>
              <strong>Template</strong>
              <span>模板保存与发布</span>
            </div>
            <div>
              <strong>Session</strong>
              <span>登录状态记忆</span>
            </div>
          </div>
        </section>

        <section className="login-form-panel">
          <div className="login-form-head">
            <div className="login-panel-label">Sign In</div>
            <h2>欢迎回来</h2>
            <p>登录后可以继续编辑页面、查看已发布模板，也可以用对话方式生成或修改模板内容。</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className={`login-field ${activeField === 'account' ? 'active' : ''}`}>
              <span>账号</span>
              <div className="login-input-shell">
                <input
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                  onFocus={() => setActiveField('account')}
                  onBlur={() => setActiveField(null)}
                  placeholder="请输入账号或邮箱"
                />
              </div>
            </label>

            <label className={`login-field ${activeField === 'password' ? 'active' : ''}`}>
              <span>密码</span>
              <div className="login-input-shell has-toggle">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onFocus={() => setActiveField('password')}
                  onBlur={() => setActiveField(null)}
                  placeholder="请输入登录密码"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? '隐藏' : '显示'}
                </button>
              </div>
            </label>

            <div className="login-form-row">
              <label className="remember-toggle">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span>记住登录态</span>
              </label>
              <div className="login-inline-tip">演示账号：`admin / Builder2026!`</div>
            </div>

            {error ? <div className="login-error">{error}</div> : null}

            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? '登录中...' : '进入系统'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
