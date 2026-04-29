import type { FormField, PageNode } from '../types/schema';
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

function BasicTextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SizeSelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace('px', '')}
          </option>
        ))}
      </select>
    </label>
  );
}

function DynamicListEditor({
  title,
  items,
  addText,
  newItemText,
  onChange,
}: {
  title: string;
  items: string[];
  addText: string;
  newItemText: string;
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="dynamic-group">
      <div className="group-header">
        <strong>{title}</strong>
        <button type="button" onClick={() => onChange([...items, newItemText])}>
          {addText}
        </button>
      </div>
      {items.map((item, index) => (
        <div key={`${item}-${index}`} className="dynamic-row simple">
          <input
            value={item}
            onChange={(event) => {
              const nextItems = [...items];
              nextItems[index] = event.target.value;
              onChange(nextItems);
            }}
          />
          <button
            type="button"
            onClick={() => {
              const nextItems = [...items];
              nextItems.splice(index, 1);
              onChange(nextItems);
            }}
          >
            删除
          </button>
        </div>
      ))}
    </div>
  );
}

function StatGridEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="dynamic-group">
      <div className="group-header">
        <strong>指标项</strong>
        <button type="button" onClick={() => onChange([...items, '99%|新的指标'])}>
          新增指标
        </button>
      </div>
      {items.map((item, index) => {
        const [value = '', label = ''] = item.split('|');
        return (
          <div key={`${item}-${index}`} className="dynamic-row pair">
            <input
              value={value}
              placeholder="数值"
              onChange={(event) => {
                const nextItems = [...items];
                nextItems[index] = `${event.target.value}|${label}`;
                onChange(nextItems);
              }}
            />
            <input
              value={label}
              placeholder="标签"
              onChange={(event) => {
                const nextItems = [...items];
                nextItems[index] = `${value}|${event.target.value}`;
                onChange(nextItems);
              }}
            />
            <button
              type="button"
              onClick={() => {
                const nextItems = [...items];
                nextItems.splice(index, 1);
                onChange(nextItems);
              }}
            >
              删除
            </button>
          </div>
        );
      })}
    </div>
  );
}

function FormFieldsEditor({
  fields,
  onChange,
}: {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}) {
  const updateField = (index: number, patch: Partial<FormField>) => {
    const nextFields = fields.slice();
    nextFields[index] = { ...fields[index], ...patch };
    onChange(nextFields);
  };

  const removeField = (index: number) => {
    const nextFields = fields.slice();
    nextFields.splice(index, 1);
    onChange(nextFields);
  };

  const addField = () => {
    onChange([
      ...fields,
      {
        id: createId('field'),
        label: '新字段',
        type: 'text',
        placeholder: '请输入内容',
        required: false,
        options: [],
      },
    ]);
  };

  return (
    <div className="dynamic-group">
      <div className="group-header">
        <strong>表单字段</strong>
        <button type="button" onClick={addField}>
          新增字段
        </button>
      </div>

      {fields.map((field, index) => (
        <div className="field-editor-card" key={field.id}>
          <div className="field-editor-head">
            <strong>字段 {index + 1}</strong>
            <button type="button" onClick={() => removeField(index)}>
              删除字段
            </button>
          </div>

          <div className="field-editor-grid">
            <BasicTextField
              label="字段名"
              value={field.label}
              onChange={(value) => updateField(index, { label: value })}
            />

            <label>
              字段类型
              <select
                value={field.type}
                onChange={(event) => {
                  const nextType = event.target.value as FormField['type'];
                  updateField(index, {
                    type: nextType,
                    options: nextType === 'select' ? field.options ?? ['选项 A', '选项 B'] : [],
                  });
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
                onChange={(event) => updateField(index, { placeholder: event.target.value })}
              />
            </label>

            <label className="checkbox-line full-line">
              <input
                type="checkbox"
                checked={Boolean(field.required)}
                onChange={(event) => updateField(index, { required: event.target.checked })}
              />
              必填字段
            </label>

            {field.type === 'select' ? (
              <label className="full-line">
                下拉选项（用 | 分隔）
                <input
                  value={(field.options ?? []).join('|')}
                  onChange={(event) =>
                    updateField(index, {
                      options: event.target.value
                        .split('|')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function PageMetaPanel() {
  const schema = useEditorStore((state) => state.schema);
  const submissions = useEditorStore((state) => state.submissions);
  const updatePageMeta = useEditorStore((state) => state.updatePageMeta);

  return (
    <aside className="panel properties-panel panel-accent-amber">
      <div className="panel-title">页面配置</div>

      <BasicTextField
        label="页面标题"
        value={schema.pageMeta.title}
        onChange={(value) => updatePageMeta({ title: value })}
      />

      <BasicTextField
        label="页面描述"
        value={schema.pageMeta.description}
        onChange={(value) => updatePageMeta({ description: value })}
      />

      <SelectField
        label="页面背景"
        value={schema.pageMeta.background}
        options={pageBackgroundOptions}
        onChange={(value) => updatePageMeta({ background: value })}
      />

      <div className="schema-preview">
        <div className="schema-preview-title">最近提交结果</div>
        <pre>
          {submissions.length
            ? JSON.stringify(submissions[0], null, 2)
            : '暂时还没有表单提交结果，请切换到预览态填写并提交表单。'}
        </pre>
      </div>
    </aside>
  );
}

function NodeMetaFields({
  node,
  onRename,
  onUpdateProps,
}: {
  node: PageNode;
  onRename: (name: string) => void;
  onUpdateProps: (patch: Record<string, string>) => void;
}) {
  return (
    <>
      <BasicTextField label="组件名称" value={node.name} onChange={onRename} />

      {'text' in node.props && typeof node.props.text === 'string' ? (
        <BasicTextField
          label="展示文案"
          value={String(node.props.text ?? '')}
          onChange={(value) => onUpdateProps({ text: value })}
        />
      ) : null}

      {'title' in node.props && typeof node.props.title === 'string' ? (
        <BasicTextField
          label="标题"
          value={String(node.props.title ?? '')}
          onChange={(value) => onUpdateProps({ title: value })}
        />
      ) : null}

      {'subtitle' in node.props ? (
        <BasicTextField
          label="副标题"
          value={String(node.props.subtitle ?? '')}
          onChange={(value) => onUpdateProps({ subtitle: value })}
        />
      ) : null}

      {'note' in node.props ? (
        <BasicTextField
          label="补充说明"
          value={String(node.props.note ?? '')}
          onChange={(value) => onUpdateProps({ note: value })}
        />
      ) : null}

      {'ctaText' in node.props ? (
        <BasicTextField
          label="主按钮文案"
          value={String(node.props.ctaText ?? '')}
          onChange={(value) => onUpdateProps({ ctaText: value })}
        />
      ) : null}

      {'buttonText' in node.props ? (
        <BasicTextField
          label="按钮文案"
          value={String(node.props.buttonText ?? '')}
          onChange={(value) => onUpdateProps({ buttonText: value })}
        />
      ) : null}

      {'src' in node.props ? (
        <>
          <BasicTextField
            label="图片地址"
            value={String(node.props.src ?? '')}
            onChange={(value) => onUpdateProps({ src: value })}
          />
          <BasicTextField
            label="图片 alt"
            value={String(node.props.alt ?? '')}
            onChange={(value) => onUpdateProps({ alt: value })}
          />
        </>
      ) : null}
    </>
  );
}

function NodeStyleFields({
  node,
  onUpdateStyle,
}: {
  node: PageNode;
  onUpdateStyle: (patch: Record<string, string>) => void;
}) {
  return (
    <>
      <SelectField
        label="背景样式"
        value={String(node.style.background ?? '#ffffff')}
        options={backgroundOptions}
        onChange={(value) => onUpdateStyle({ background: value })}
      />

      <SelectField
        label="文字颜色"
        value={String(node.style.color ?? '#111827')}
        options={textColorOptions}
        onChange={(value) => onUpdateStyle({ color: value })}
      />

      <SizeSelectField
        label="圆角"
        value={String(node.style.borderRadius ?? '16px')}
        options={radiusOptions}
        onChange={(value) => onUpdateStyle({ borderRadius: value })}
      />

      <SizeSelectField
        label="内边距"
        value={String(node.style.padding ?? '24px')}
        options={paddingOptions}
        onChange={(value) => onUpdateStyle({ padding: value })}
      />

      {node.type === 'text' || node.type === 'hero' ? (
        <SizeSelectField
          label="字号"
          value={String(node.style.fontSize ?? (node.type === 'hero' ? '34px' : '28px'))}
          options={fontSizeOptions}
          onChange={(value) => onUpdateStyle({ fontSize: value })}
        />
      ) : null}
    </>
  );
}

export function PropertiesPanel() {
  const node = useSelectedNode();
  const updateNodeProps = useEditorStore((state) => state.updateNodeProps);
  const updateNodeStyle = useEditorStore((state) => state.updateNodeStyle);
  const updateNodeAction = useEditorStore((state) => state.updateNodeAction);
  const renameNode = useEditorStore((state) => state.renameNode);

  if (!node) {
    return <PageMetaPanel />;
  }

  const firstAction = node.actions?.[0] ?? { type: 'none' as const, payload: '' };
  const formFields = ((node.props.fields as FormField[] | undefined) ?? []).slice();
  const featureItems = String(node.props.items ?? '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
  const statItems = String(node.props.items ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const handlePropsChange = (patch: Record<string, string>) => {
    updateNodeProps(node.id, patch);
  };

  const handleStyleChange = (patch: Record<string, string>) => {
    updateNodeStyle(node.id, patch);
  };

  const handleFormFieldsChange = (fields: FormField[]) => {
    if (node.type !== 'form') return;
    updateNodeProps(node.id, { fields });
  };

  return (
    <aside className="panel properties-panel panel-accent-amber">
      <div className="panel-title">属性面板</div>

      <NodeMetaFields
        node={node}
        onRename={(name) => renameNode(node.id, name)}
        onUpdateProps={handlePropsChange}
      />

      {'items' in node.props && typeof node.props.items === 'string' && node.type !== 'stat-grid' ? (
        <DynamicListEditor
          title="卖点列表"
          items={featureItems}
          addText="新增卖点"
          newItemText="新的卖点"
          onChange={(items) => updateNodeProps(node.id, { items: items.join('|') })}
        />
      ) : null}

      {node.type === 'stat-grid' ? (
        <StatGridEditor
          items={statItems}
          onChange={(items) => updateNodeProps(node.id, { items: items.join(',') })}
        />
      ) : null}

      {node.type === 'form' ? <FormFieldsEditor fields={formFields} onChange={handleFormFieldsChange} /> : null}

      <NodeStyleFields node={node} onUpdateStyle={handleStyleChange} />

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

      {firstAction.type !== 'none' ? (
        <BasicTextField
          label="动作参数"
          value={firstAction.payload ?? ''}
          onChange={(value) => updateNodeAction(node.id, firstAction.type, value)}
        />
      ) : null}

      <div className="schema-preview">
        <div className="schema-preview-title">当前节点 Schema</div>
        <pre>{JSON.stringify(node, null, 2)}</pre>
      </div>
    </aside>
  );
}
