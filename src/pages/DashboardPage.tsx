import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { MaterialType, PageNode } from '../types/schema';

interface DashboardPageProps {
  onNavigate: (route: 'editor' | 'published' | 'settings') => void;
}

const materialLabelMap: Record<MaterialType, string> = {
  hero: '主视觉',
  form: '表单',
  'feature-list': '亮点区',
  'stat-grid': '数据区',
  image: '图片',
  button: '按钮',
  text: '文本',
  container: '容器',
};

function flattenNodes(nodes: PageNode[]): PageNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children ?? [])]);
}

function formatShortDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getChartY(value: number, height: number, maxValue: number) {
  return height - (value / Math.max(maxValue, 1)) * height;
}

function buildLinePath(values: number[], xPositions: number[], height: number, maxValue: number) {
  if (!values.length) return '';
  return values
    .map((value, index) => {
      const x = xPositions[index] ?? 0;
      const y = getChartY(value, height, maxValue);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const templates = useEditorStore((state) => state.templates);
  const schema = useEditorStore((state) => state.schema);
  const submissions = useEditorStore((state) => state.submissions);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  const barGroupRef = useRef<HTMLDivElement | null>(null);
  const [measuredChartWidth, setMeasuredChartWidth] = useState(320);

  const publishedTemplates = useMemo(
    () => templates.filter((item) => item.publishedSchema),
    [templates],
  );

  const latestTemplates = useMemo(
    () =>
      [...templates]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4),
    [templates],
  );

  const dashboardStats = useMemo(() => {
    const recentDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return date;
    });

    const daySeries = recentDays.map((date) => {
      const next = new Date(date);
      next.setDate(date.getDate() + 1);

      const edited = templates.filter((template) => {
        const updatedAt = new Date(template.updatedAt);
        return updatedAt >= date && updatedAt < next;
      }).length;

      const published = templates.filter((template) => {
        if (!template.publishedAt) return false;
        const publishedAt = new Date(template.publishedAt);
        return publishedAt >= date && publishedAt < next;
      }).length;

      return {
        label: formatShortDate(date),
        edited,
        published,
      };
    });

    const flatNodes = flattenNodes(schema.nodes);
    const totalNodes = flatNodes.length;
    const distribution = Object.entries(
      flatNodes.reduce<Record<string, number>>((accumulator, node) => {
        accumulator[node.type] = (accumulator[node.type] ?? 0) + 1;
        return accumulator;
      }, {}),
    )
      .map(([type, count]) => ({
        type: type as MaterialType,
        label: materialLabelMap[type as MaterialType] ?? type,
        count,
        ratio: totalNodes ? Math.round((count / totalNodes) * 100) : 0,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);

    const averageNodesPerTemplate = templates.length
      ? Math.round(
          templates.reduce((sum, template) => sum + flattenNodes(template.draftSchema.nodes).length, 0) /
            templates.length,
        )
      : 0;

    const publishRate = templates.length ? Math.round((publishedTemplates.length / templates.length) * 100) : 0;
    const topMaterial = distribution[0]?.label ?? '暂无';
    const latestPublishedAt = [...publishedTemplates]
      .sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime())[0]
      ?.publishedAt;

    return {
      daySeries,
      distribution,
      averageNodesPerTemplate,
      publishRate,
      topMaterial,
      latestPublishedAt: latestPublishedAt ? new Date(latestPublishedAt).toLocaleString() : '暂无发布记录',
    };
  }, [publishedTemplates, schema.nodes, templates]);

  const chartMax = Math.max(
    1,
    ...dashboardStats.daySeries.map((item) => Math.max(item.edited, item.published)),
  );
  useEffect(() => {
    const element = barGroupRef.current;
    if (!element) return;

    const syncWidth = () => {
      const nextWidth = element.clientWidth;
      if (nextWidth > 0) {
        setMeasuredChartWidth(nextWidth);
      }
    };

    syncWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncWidth);
      return () => window.removeEventListener('resize', syncWidth);
    }

    const observer = new ResizeObserver(() => syncWidth());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const chartWidth = measuredChartWidth;
  const chartHeight = 126;
  const columnGap = 12;
  const columnWidth =
    (chartWidth - columnGap * Math.max(dashboardStats.daySeries.length - 1, 0)) /
    Math.max(dashboardStats.daySeries.length, 1);
  const chartXPositions = dashboardStats.daySeries.map(
    (_, index) => columnWidth / 2 + index * (columnWidth + columnGap),
  );
  const editedLinePath = buildLinePath(
    dashboardStats.daySeries.map((item) => item.edited),
    chartXPositions,
    chartHeight,
    chartMax,
  );
  const publishedLinePath = buildLinePath(
    dashboardStats.daySeries.map((item) => item.published),
    chartXPositions,
    chartHeight,
    chartMax,
  );

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero-card">
        <div>
          <div className="dashboard-eyebrow">Workspace Overview</div>
          <h2>页面搭建与模板管理工作台</h2>
          <p>
            统一管理页面搭建、模板发布、资产复用与运行概览，帮助团队更高效地完成页面生产与维护。
          </p>
        </div>
        <div className="dashboard-hero-actions">
          <button type="button" onClick={() => onNavigate('editor')}>进入页面编辑器</button>
          <button type="button" onClick={() => onNavigate('published')}>查看模板发布页</button>
        </div>
      </section>

      <section className="dashboard-metric-grid">
        <article className="dashboard-metric-card">
          <span>模板总数</span>
          <strong>{templates.length}</strong>
          <p>包括草稿模板，以及通过 AI 生成后进入模板中心的页面草案。</p>
        </article>
        <article className="dashboard-metric-card">
          <span>已发布模板</span>
          <strong>{publishedTemplates.length}</strong>
          <p>发布后的模板可以继续在发布页中预览、修改，或重新载入编辑器。</p>
        </article>
        <article className="dashboard-metric-card">
          <span>当前页面节点</span>
          <strong>{flattenNodes(schema.nodes).length}</strong>
          <p>当前页面结构由统一 Schema 管理，支撑编辑态、发布态和 AI 修改复用。</p>
        </article>
        <article className="dashboard-metric-card">
          <span>最近表单提交</span>
          <strong>{submissions.length}</strong>
          <p>预览态下的表单提交结果会先写入本地状态，方便调试和后续扩展。</p>
        </article>
      </section>

      <section className="dashboard-analytics-grid">
        <article className="dashboard-panel dashboard-chart-panel">
          <div className="dashboard-panel-head">
            <h3>近 7 日模板活跃度</h3>
            <span>Trend</span>
          </div>
          <div className="dashboard-chart-legend">
            <span><i className="legend-dot edit" />编辑更新</span>
            <span><i className="legend-dot publish" />发布次数</span>
          </div>
          <div className="dashboard-trend-chart">
            {hoveredTrendIndex !== null ? (
              <div
                className="dashboard-chart-tooltip"
                style={{
                  left: `calc(${((hoveredTrendIndex + 0.5) / dashboardStats.daySeries.length) * 100}% - 60px)`,
                }}
              >
                <strong>{dashboardStats.daySeries[hoveredTrendIndex].label}</strong>
                <span>编辑更新 {dashboardStats.daySeries[hoveredTrendIndex].edited} 次</span>
                <span>发布次数 {dashboardStats.daySeries[hoveredTrendIndex].published} 次</span>
              </div>
            ) : null}
            <div className="dashboard-bar-group" ref={barGroupRef}>
              {dashboardStats.daySeries.map((item, index) => (
                <div
                  key={item.label}
                  className={`dashboard-bar-column ${hoveredTrendIndex === index ? 'active' : ''}`}
                  onMouseEnter={() => setHoveredTrendIndex(index)}
                  onMouseLeave={() => setHoveredTrendIndex(null)}
                >
                  <div
                    className="dashboard-bar"
                    style={{ height: `${Math.max(14, (item.edited / chartMax) * chartHeight)}px` }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="dashboard-line-chart" aria-hidden="true">
              <path d={editedLinePath} className="chart-line edit" />
              <path d={publishedLinePath} className="chart-line publish" />
              {dashboardStats.daySeries.map((item, index) => {
                const editedY = getChartY(item.edited, chartHeight, chartMax);
                const publishedY = getChartY(item.published, chartHeight, chartMax);
                return (
                  <g key={item.label}>
                    <circle
                      className={`chart-point edit ${hoveredTrendIndex === index ? 'active' : ''}`}
                      cx={chartXPositions[index]}
                      cy={editedY}
                      r={hoveredTrendIndex === index ? 5 : 4}
                    />
                    <circle
                      className={`chart-point publish ${hoveredTrendIndex === index ? 'active' : ''}`}
                      cx={chartXPositions[index]}
                      cy={publishedY}
                      r={hoveredTrendIndex === index ? 5 : 4}
                    />
                    <circle
                      className="chart-hit-area"
                      cx={chartXPositions[index]}
                      cy={Math.min(editedY, publishedY)}
                      r={16}
                      onMouseEnter={() => setHoveredTrendIndex(index)}
                      onMouseLeave={() => setHoveredTrendIndex(null)}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </article>

        <article className="dashboard-panel dashboard-chart-panel">
          <div className="dashboard-panel-head">
            <h3>当前页面结构分布</h3>
            <span>Composition</span>
          </div>
          <div className="dashboard-composition-list">
            {dashboardStats.distribution.length ? (
              dashboardStats.distribution.map((item) => (
                <div key={item.type} className="dashboard-composition-item">
                  <div className="dashboard-composition-meta">
                    <strong>{item.label}</strong>
                    <span>{item.count} 个节点</span>
                  </div>
                  <div className="dashboard-composition-track">
                    <div
                      className="dashboard-composition-fill"
                      style={{ width: `${Math.max(item.ratio, 12)}%` }}
                    />
                  </div>
                  <em>{item.ratio}%</em>
                </div>
              ))
            ) : (
              <div className="dashboard-empty">当前页面还没有可统计的节点结构。</div>
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-panel">
          <div className="dashboard-panel-head">
            <h3>系统洞察</h3>
            <span>Insights</span>
          </div>
          <div className="dashboard-insight-grid">
            <div className="dashboard-insight-card">
              <span>模板发布率</span>
              <strong>{dashboardStats.publishRate}%</strong>
              <p>当前模板中已有 {publishedTemplates.length} 份进入发布态。</p>
            </div>
            <div className="dashboard-insight-card">
              <span>平均节点规模</span>
              <strong>{dashboardStats.averageNodesPerTemplate}</strong>
              <p>按模板草稿统计，适合描述页面复杂度和 Schema 承载能力。</p>
            </div>
            <div className="dashboard-insight-card">
              <span>高频组件</span>
              <strong>{dashboardStats.topMaterial}</strong>
              <p>当前页面最常用的模块类型，可作为后续物料优化依据。</p>
            </div>
            <div className="dashboard-insight-card">
              <span>最近发布时间</span>
              <strong className="dashboard-insight-time">{dashboardStats.latestPublishedAt}</strong>
              <p>这里能体现模板从草稿到发布的完整生命周期。</p>
            </div>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-head">
            <h3>常用入口</h3>
            <span>Quick Access</span>
          </div>
          <div className="dashboard-shortcuts">
            <button type="button" onClick={() => onNavigate('editor')}>
              <strong>进入页面编辑器</strong>
              <span>拖拽组件、编辑属性、导入导出 Schema，继续搭建页面。</span>
            </button>
            <button type="button" onClick={() => onNavigate('published')}>
              <strong>查看模板发布页</strong>
              <span>浏览已发布模板，并基于自然语言继续修改页面草案。</span>
            </button>
            <button type="button" onClick={() => onNavigate('settings')}>
              <strong>打开系统设置</strong>
              <span>查看本地数据、主题风格、Schema 版本和项目状态。</span>
            </button>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel-head">
            <h3>最近模板</h3>
            <span>Recent Templates</span>
          </div>
          {latestTemplates.length ? (
            <div className="dashboard-template-list">
              {latestTemplates.map((template) => (
                <div key={template.id} className="dashboard-template-item">
                  <strong>{template.name}</strong>
                  <span>{template.publishedSchema ? '已发布版本' : '草稿版本'}</span>
                  <small>{new Date(template.updatedAt).toLocaleString()}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">当前还没有模板记录，可以先进入编辑器保存一份草稿。</div>
          )}
        </article>
      </section>
    </div>
  );
}
