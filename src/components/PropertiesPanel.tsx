import type { FormField } from '../types/schema';
import { createId } from '../utils/id';
import { useEditorStore, useSelectedNode } from '../store/editorStore';

const pageBackgroundOptions = [
  { label: '浅蓝背景', value: '#eef4ff' },
  { label: '浅灰背景', value: '#f8fafc' },
  { label: '纯白背景', value: '#ffffff' },
  { label: '蓝白渐变', value: 'linear-gradient(180deg, #eef4ff 0%, #ffffff 100%)' },
  { label: '灰白渐变', value: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' },
];

const backgroundOptions = [
  { label: '白色', value: '#ffffff' },
  { label: '浅灰', value: '#f8fafc' },
  { label: '浅蓝', value: '#eff6ff' },
  { label: '蓝色浅底', value: '#dbeafe' },
  { label: '蓝紫渐变', value: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' },
  { label: '深色渐变', value: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)' },
];

const textColorOptions = [
  { label: '深灰', value: '#111827' },
  { label: '深蓝灰', value: '#0f172a' },
  { label: '蓝色', value: '#1d4ed8' },
  { label: '白色', value: '#ffffff' },
  { label: '中灰', value: '#475569' },
];

const radiusOptions = ['0px', '8px', '12px', '16px', '20px', '24px'];
const paddingOptions = ['12px', '16px', '20px', '24px', '32px'];
const fontSizeOptions = ['14px', '16px', '18px', '20px', '24px', '28px', '32px', '34px', '40px'];

export function PropertiesPanel() {
  const node = useSelectedNode();
  const schema = useEditorStore((state) => state.schema);
  const submissions = useEditorStore((state) => state.submissions);
  const updateNodeProps = useEditorStore((state) => state.updateNodeProps);
  const updateNodeStyle = useEditorStore((state) => state.updateNodeStyle);
  const updateNodeAction = useEditorStore((state) => state.updateNodeAction);
  const renameNode = useEditorStore((state) => state.renameNode);
  const updatePageMeta = useEditorStore((state) => state.updatePageMeta);

  const updateFormFields = (fields: FormField[]) => {
    if (!node || node.type !== 'form') return;
    updateNodeProps(node.id, { fields });
  };

  const addField = () => {
    if (!node || node.type !== 'form') return;
    const fields = ((node.props.fields as FormField[] | undefined) ?? []).slice();
    fields.push({
      id: createId('field'),
      label: '新字段',
      type: 'text',
      placeholder: '请输入内容',
      required: false,
      options: [],
    });
    updateFormFields(fields);
  };

  if (!node) {
    return (
      <aside className="panel properties-panel panel-accent-amber">
        <div className="panel-title">页面配置</div>

        <label>
          页面标题
          <input
            value={schema.pageMeta.title}
            onChange={(event) => updatePageMeta({ title: event.target.value })}
          />
        </label>

        <label>
          页面描述
          <input
            value={schema.pageMeta.description}
            onChange={(event) => updatePageMeta({ description: event.target.value })}
          />
        </label>

        <label>
          页面背景
          <select
            value={schema.pageMeta.background}
            onChange={(event) => updatePageMeta({ background: event.target.value })}
          >
            {pageBackgroundOptions.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>

        <div className="schema-preview">
          <div className="schema-preview-title">最近提交结果</div>
          <pre>
            {submissions.length
              ? JSON.stringify(submissions[0], null, 2)
              : '暂无提交结果，请切换到预览态填写并提交表单。'}
          </pre>
        </div>
      </aside>
    );
  }

  const firstAction = node.actions?.[0] ?? { type: 'none' as const, payload: '' };

  return (
    <aside className="panel properties-panel panel-accent-amber">
      <div className="panel-title">属性面板</div>

      <label>
        组件名称
        <input value={node.name} onChange={(event) => renameNode(node.id, event.target.value)} />
      </label>

      {'text' in node.props && typeof node.props.text === 'string' && (
        <label>
          展示文案
          <input
            value={String(node.props.text ?? '')}
            onChange={(event) => updateNodeProps(node.id, { text: event.target.value })}
          />
        </label>
      )}

      {'title' in node.props && typeof node.props.title === 'string' && (
        <label>
          标题
          <input
            value={String(node.props.title ?? '')}
            onChange={(event) => updateNodeProps(node.id, { title: event.target.value })}
          />
        </label>
      )}

      {'subtitle' in node.props && (
        <label>
          副标题
          <input
            value={String(node.props.subtitle ?? '')}
            onChange={(event) => updateNodeProps(node.id, { subtitle: event.target.value })}
          />
        </label>
      )}

      {'note' in node.props && (
        <label>
          补充说明
          <input
            value={String(node.props.note ?? '')}
            onChange={(event) => updateNodeProps(node.id, { note: event.target.value })}
          />
        </label>
      )}

      {'ctaText' in node.props && (
        <label>
          主按钮文案
          <input
            value={String(node.props.ctaText ?? '')}
            onChange={(event) => updateNodeProps(node.id, { ctaText: event.target.value })}
          />
        </label>
      )}

      {'buttonText' in node.props && (
        <label>
          按钮文案
          <input
            value={String(node.props.buttonText ?? '')}
            onChange={(event) => updateNodeProps(node.id, { buttonText: event.target.value })}
          />
        </label>
      )}

      {'src' in node.props && (
        <>
          <label>
            图片地址
            <input
              value={String(node.props.src ?? '')}
              onChange={(event) => updateNodeProps(node.id, { src: event.target.value })}
            />
          </label>
          <label>
            图片 alt
            <input
              value={String(node.props.alt ?? '')}
              onChange={(event) => updateNodeProps(node.id, { alt: event.target.value })}
            />
          </label>
        </>
      )}

      {'items' in node.props && typeof node.props.items === 'string' && node.type !== 'stat-grid' && (
        <div className="dynamic-group">
          <div className="group-header">
            <strong>卖点列表</strong>
            <button
              type="button"
              onClick={() => {
                const items = String(node.props.items ?? '').split('|').filter(Boolean);
                items.push('新的卖点');
                updateNodeProps(node.id, { items: items.join('|') });
              }}
            >
              新增卖点
            </button>
          </div>
          {String(node.props.items ?? '')
            .split('|')
            .filter(Boolean)
            .map((item, index, list) => (
              <div key={`${item}-${index}`} className="dynamic-row simple">
                <input
                  value={item}
                  onChange={(event) => {
                    const next = [...list];
                    next[index] = event.target.value;
                    updateNodeProps(node.id, { items: next.join('|') });
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = [...list];
                    next.splice(index, 1);
                    updateNodeProps(node.id, { items: next.join('|') });
                  }}
                >
                  删除
                </button>
              </div>
            ))}
        </div>
      )}

      {node.type === 'stat-grid' && (
        <div className="dynamic-group">
          <div className="group-header">
            <strong>指标项</strong>
            <button
              type="button"
              onClick={() => {
                const list = String(node.props.items ?? '').split(',').filter(Boolean);
                list.push('99%|新的指标');
                updateNodeProps(node.id, { items: list.join(',') });
              }}
            >
              新增指标
            </button>
          </div>
          {String(node.props.items ?? '')
            .split(',')
            .filter(Boolean)
            .map((item, index, list) => {
              const [value, label] = item.split('|');
              return (
                <div key={`${item}-${index}`} className="dynamic-row pair">
                  <input
                    value={value ?? ''}
                    onChange={(event) => {
                      const next = [...list];
                      next[index] = `${event.target.value}|${label ?? ''}`;
                      updateNodeProps(node.id, { items: next.join(',') });
                    }}
                    placeholder="数值"
                  />
                  <input
                    value={label ?? ''}
                    onChange={(event) => {
                      const next = [...list];
                      next[index] = `${value ?? ''}|${event.target.value}`;
                      updateNodeProps(node.id, { items: next.join(',') });
                    }}
                    placeholder="标签"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...list];
                      next.splice(index, 1);
                      updateNodeProps(node.id, { items: next.join(',') });
                    }}
                  >
                    删除
                  </button>
                </div>
              );
            })}
        </div>
      )}

      {node.type === 'form' && (
        <div className="dynamic-group">
          <div className="group-header">
            <strong>表单字段</strong>
            <button type="button" onClick={addField}>新增字段</button>
          </div>
          {((node.props.fields as FormField[] | undefined) ?? []).map((field, index, fields) => (
            <div className="field-editor-card" key={field.id}>
              <div className="field-editor-head">
                <strong>字段 {index + 1}</strong>
                <button
                  type="button"
                  onClick={() => {
                    const next = fields.slice();
                    next.splice(index, 1);
                    updateFormFields(next);
                  }}
                >
                  删除字段
                </button>
              </div>
              <div className="field-editor-grid">
                <label>
                  字段名
                  <input
                    value={field.label}
                    onChange={(event) => {
                      const next = fields.slice();
                      next[index] = { ...field, label: event.target.value };
                      updateFormFields(next);
                    }}
                  />
                </label>
                <label>
                  字段类型
                  <select
                    value={field.type}
                    onChange={(event) => {
                      const nextType = event.target.value as FormField['type'];
                      const next = fields.slice();
                      next[index] = {
                        ...field,
                        type: nextType,
                        options: nextType === 'select' ? field.options ?? ['选项 A', '选项 B'] : [],
                      };
                      updateFormFields(next);
                    }}
                  >
                    <option value="text">文本</option>
                    <option value="tel">手机号</option>
                    <option value="email">邮箱</option>
                    <option value="textarea">多行文本</option>
                    <option value="select">下拉选择</option>
                  </select>
                </label>
                <label className="full-line">
                  Placeholder
                  <input
                    value={field.placeholder ?? ''}
                    onChange={(event) => {
                      const next = fields.slice();
                      next[index] = { ...field, placeholder: event.target.value };
                      updateFormFields(next);
                    }}
                  />
                </label>
                <label className="checkbox-line full-line">
                  <input
                    type="checkbox"
                    checked={Boolean(field.required)}
                    onChange={(event) => {
                      const next = fields.slice();
                      next[index] = { ...field, required: event.target.checked };
                      updateFormFields(next);
                    }}
                  />
                  必填字段
                </label>
                {field.type === 'select' && (
                  <label className="full-line">
                    下拉选项（用 | 分隔）
                    <input
                      value={(field.options ?? []).join('|')}
                      onChange={(event) => {
                        const next = fields.slice();
                        next[index] = {
                          ...field,
                          options: event.target.value.split('|').map((item) => item.trim()).filter(Boolean),
                        };
                        updateFormFields(next);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <label>
        背景样式
        <select
          value={String(node.style.background ?? '#ffffff')}
          onChange={(event) => updateNodeStyle(node.id, { background: event.target.value })}
        >
          {backgroundOptions.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </label>

      <label>
        文字颜色
        <select
          value={String(node.style.color ?? '#111827')}
          onChange={(event) => updateNodeStyle(node.id, { color: event.target.value })}
        >
          {textColorOptions.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </label>

      <label>
        圆角
        <select
          value={String(node.style.borderRadius ?? '16px')}
          onChange={(event) => updateNodeStyle(node.id, { borderRadius: event.target.value })}
        >
          {radiusOptions.map((item) => (
            <option key={item} value={item}>{item.replace('px', '')}</option>
          ))}
        </select>
      </label>

      <label>
        内边距
        <select
          value={String(node.style.padding ?? '24px')}
          onChange={(event) => updateNodeStyle(node.id, { padding: event.target.value })}
        >
          {paddingOptions.map((item) => (
            <option key={item} value={item}>{item.replace('px', '')}</option>
          ))}
        </select>
      </label>

      {(node.type === 'text' || node.type === 'hero') && (
        <label>
          字号
          <select
            value={String(node.style.fontSize ?? (node.type === 'hero' ? '34px' : '28px'))}
            onChange={(event) => updateNodeStyle(node.id, { fontSize: event.target.value })}
          >
            {fontSizeOptions.map((item) => (
              <option key={item} value={item}>{item.replace('px', '')}</option>
            ))}
          </select>
        </label>
      )}

      <label>
        交互动作
        <select
          value={firstAction.type}
          onChange={(event) =>
            updateNodeAction(node.id, event.target.value as 'none' | 'alert' | 'navigate', firstAction.payload)
          }
        >
          <option value="none">无</option>
          <option value="alert">弹窗提示</option>
          <option value="navigate">跳转链接</option>
        </select>
      </label>

      {firstAction.type !== 'none' && (
        <label>
          动作参数
          <input
            value={firstAction.payload ?? ''}
            onChange={(event) => updateNodeAction(node.id, firstAction.type, event.target.value)}
            placeholder={firstAction.type === 'navigate' ? 'https://example.com' : '提示内容'}
          />
        </label>
      )}

      <div className="schema-preview">
        <div className="schema-preview-title">当前节点 Schema</div>
        <pre>{JSON.stringify(node, null, 2)}</pre>
      </div>
    </aside>
  );
}
