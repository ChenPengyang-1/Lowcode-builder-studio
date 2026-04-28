import { useEditorStore } from '../store/editorStore';
import { CURRENT_SCHEMA_VERSION } from '../utils/schemaRuntime';
import type { AuthSession } from '../utils/auth';
import type { ThemeMode } from '../utils/theme';

interface SettingsPageProps {
  currentUser: AuthSession;
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

export function SettingsPage({ currentUser, themeMode, onThemeChange }: SettingsPageProps) {
  const templates = useEditorStore((state) => state.templates);
  const submissions = useEditorStore((state) => state.submissions);
  const publishedCount = templates.filter((item) => item.hasPublished).length;

  return (
    <div className="settings-page">
      <section className="settings-card">
        <div className="dashboard-panel-head">
          <h3>外观设置</h3>
          <span>Appearance</span>
        </div>
        <div className="settings-theme-row">
          <button
            type="button"
            className={`settings-theme-option ${themeMode === 'dark' ? 'active' : ''}`}
            onClick={() => onThemeChange('dark')}
          >
            <strong>深色模式</strong>
            <span>更适合当前后台和编辑器的视觉风格。</span>
          </button>
          <button
            type="button"
            className={`settings-theme-option ${themeMode === 'light' ? 'active' : ''}`}
            onClick={() => onThemeChange('light')}
          >
            <strong>浅色模式</strong>
            <span>更适合突出页面层级和卡片结构，整体会更明亮一些。</span>
          </button>
        </div>
      </section>

      <section className="settings-card">
        <div className="dashboard-panel-head">
          <h3>账号信息</h3>
          <span>Account</span>
        </div>
        <div className="settings-list">
          <div>
            <strong>显示名称</strong>
            <span>{currentUser.displayName}</span>
          </div>
          <div>
            <strong>账号</strong>
            <span>{currentUser.account}</span>
          </div>
          <div>
            <strong>角色</strong>
            <span>{currentUser.role}</span>
          </div>
          <div>
            <strong>登录时间</strong>
            <span>{new Date(currentUser.loginAt).toLocaleString()}</span>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="dashboard-panel-head">
          <h3>项目状态</h3>
          <span>Project</span>
        </div>
        <div className="settings-list">
          <div>
            <strong>Schema 当前版本</strong>
            <span>{CURRENT_SCHEMA_VERSION}</span>
          </div>
          <div>
            <strong>登录方式</strong>
            <span>前端模拟账号密码登录，本地持久化会话</span>
          </div>
          <div>
            <strong>模板存储</strong>
            <span>SQLite + 本地运行时缓存</span>
          </div>
          <div>
            <strong>项目定位</strong>
            <span>用于展示页面编辑、模板流转和对话生成的前端项目</span>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="dashboard-panel-head">
          <h3>本地数据</h3>
          <span>Storage</span>
        </div>
        <div className="settings-list">
          <div>
            <strong>模板总数</strong>
            <span>{templates.length}</span>
          </div>
          <div>
            <strong>已发布模板</strong>
            <span>{publishedCount}</span>
          </div>
          <div>
            <strong>最近表单提交</strong>
            <span>{submissions.length}</span>
          </div>
          <div>
            <strong>当前主题</strong>
            <span>{themeMode === 'dark' ? '深色' : '浅色'}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
