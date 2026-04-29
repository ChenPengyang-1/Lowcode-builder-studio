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
            <span>更适合编辑器和后台工作台这种长时间使用的界面。</span>
          </button>
          <button
            type="button"
            className={`settings-theme-option ${themeMode === 'light' ? 'active' : ''}`}
            onClick={() => onThemeChange('light')}
          >
            <strong>浅色模式</strong>
            <span>页面层级会更清楚一些，看模板和卡片内容也更轻松。</span>
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
          <h3>项目说明</h3>
          <span>About</span>
        </div>
        <div className="settings-list">
          <div>
            <strong>Schema 版本</strong>
            <span>{CURRENT_SCHEMA_VERSION}</span>
          </div>
          <div>
            <strong>登录方式</strong>
            <span>当前是前端模拟登录，登录状态会保存在本地。</span>
          </div>
          <div>
            <strong>模板存储</strong>
            <span>模板资产走 SQLite，前端只保留当前编辑和列表缓存。</span>
          </div>
          <div>
            <strong>项目定位</strong>
            <span>
              这个项目主要是在做一个低代码页面搭建工作台，重点放在页面编辑、模板沉淀、导入导出和 AI
              对话式修改这几条链路上。
            </span>
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
