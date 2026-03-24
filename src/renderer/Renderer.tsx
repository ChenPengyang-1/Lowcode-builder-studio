import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { FormField, PageNode } from '../types/schema';

interface RendererProps {
  node: PageNode;
  selectedId?: string | null;
  mode?: 'edit' | 'preview';
  onSelect?: (id: string) => void;
  dragMaterialType?: string | null;
  dragNodeId?: string | null;
  onDropMaterial?: (parentId: string | null, index: number) => void;
  onDropNode?: (sourceId: string, parentId: string | null, index: number) => void;
}

// 节点交互动作只在预览态运行，避免编辑时误触发业务行为。
function runActions(node: PageNode) {
  const first = node.actions?.[0];
  if (!first || first.type === 'none') return;

  if (first.type === 'alert') {
    window.alert(first.payload || '未配置提示内容');
    return;
  }

  if (first.type === 'navigate') {
    if (!first.payload) {
      window.alert('未配置跳转链接');
      return;
    }
    window.open(first.payload, '_blank', 'noopener,noreferrer');
  }
}

function ChildDropZone({
  active,
  onDrop,
  label,
}: {
  active: boolean;
  onDrop: () => void;
  label: string;
}) {
  return (
    <div
      className={`child-drop-slot ${active ? 'active' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      title={label}
    >
      <span>{label}</span>
    </div>
  );
}

// 表单节点既是可配置的 Schema 区块，也是预览态下可真实交互的表单。
function FormRenderer({
  node,
  selectedId,
  mode,
  onSelect,
}: {
  node: PageNode;
  selectedId?: string | null;
  mode: 'edit' | 'preview';
  onSelect?: (id: string) => void;
}) {
  const submitForm = useEditorStore((state) => state.submitForm);
  const fields = (node.props.fields as FormField[] | undefined) ?? [];
  const interactive = mode === 'preview';

  const initialValues = useMemo(() => {
    const result: Record<string, string> = {};
    fields.forEach((field) => {
      result[field.id] = '';
    });
    return result;
  }, [fields]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  const updateValue = (fieldId: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (mode === 'edit') {
      onSelect?.(node.id);
      return;
    }

    const nextErrors: Record<string, string> = {};
    fields.forEach((field) => {
      const value = values[field.id]?.trim() ?? '';
      if (field.required && !value) {
        nextErrors[field.id] = `${field.label}为必填项`;
      }

      if (field.type === 'tel' && value && !/^1\d{10}$/.test(value)) {
        nextErrors[field.id] = '手机号格式不正确';
      }

      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        nextErrors[field.id] = '邮箱格式不正确';
      }
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload = {
      formId: node.id,
      formTitle: String(node.props.title ?? '未命名表单'),
      submittedAt: new Date().toISOString(),
      values: fields.reduce<Record<string, string>>((acc, field) => {
        acc[field.label] = values[field.id] ?? '';
        return acc;
      }, {}),
    };

    submitForm(payload);
    runActions(node);
    window.alert('提交成功，结果已输出到右侧“最近提交结果”区域。');
  };

  return (
    <div
      style={node.style as CSSProperties}
      onClick={(event) => {
        event.stopPropagation();
        if (mode === 'edit') onSelect?.(node.id);
      }}
      className={selectedId === node.id && mode === 'edit' ? 'selected-node' : ''}
      draggable={mode === 'edit'}
      onDragStart={() => useEditorStore.getState().setDragNodeId(node.id)}
      onDragEnd={() => useEditorStore.getState().setDragNodeId(null)}
    >
      <div className="form-title">{String(node.props.title ?? '表单')}</div>

      <div className="form-grid">
        {fields.map((field, index) => (
          <div key={field.id || `${field.label}-${index}`} className={`form-field-card ${field.type === 'textarea' ? 'full' : ''}`}>
            <div className="form-field-label">
              {field.label}
              {field.required ? <span className="required-dot">*</span> : null}
            </div>

            {field.type === 'textarea' && (
              <textarea
                className="mock-input"
                placeholder={field.placeholder || field.label}
                rows={3}
                readOnly={!interactive}
                value={values[field.id] ?? ''}
                onChange={(event) => updateValue(field.id, event.target.value)}
              />
            )}

            {field.type === 'select' && (
              <select
                className="mock-input"
                disabled={!interactive}
                value={values[field.id] ?? ''}
                onChange={(event) => updateValue(field.id, event.target.value)}
              >
                <option value="">{field.placeholder || `请选择${field.label}`}</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}

            {(field.type === 'text' || field.type === 'tel' || field.type === 'email') && (
              <input
                className="mock-input"
                placeholder={field.placeholder || field.label}
                readOnly={!interactive}
                type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
                value={values[field.id] ?? ''}
                onChange={(event) => updateValue(field.id, event.target.value)}
              />
            )}

            {errors[field.id] ? <div className="field-error">{errors[field.id]}</div> : null}
          </div>
        ))}
      </div>

      <button className="form-submit" onClick={handleSubmit}>
        {String(node.props.buttonText ?? '提交')}
      </button>
    </div>
  );
}

function NodeFrame({
  node,
  mode,
  selectedId,
  onSelect,
  children,
}: {
  node: PageNode;
  mode: 'edit' | 'preview';
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`node-draggable-shell ${selectedId === node.id && mode === 'edit' ? 'selected-node' : ''}`}
      draggable={mode === 'edit'}
      onDragStart={() => useEditorStore.getState().setDragNodeId(node.id)}
      onDragEnd={() => useEditorStore.getState().setDragNodeId(null)}
      onClick={(event) => {
        event.stopPropagation();
        if (mode === 'edit') onSelect?.(node.id);
      }}
    >
      {mode === 'edit' ? <div className="drag-handle-badge">拖动重排</div> : null}
      {children}
    </div>
  );
}

export function Renderer({
  node,
  selectedId,
  mode = 'edit',
  onSelect,
  dragMaterialType,
  dragNodeId,
  onDropMaterial,
  onDropNode,
}: RendererProps) {
  if (node.visible === false) return null;

  // Renderer 根据节点类型分发到不同的渲染逻辑。
  const sharedSectionProps = {
    style: node.style as CSSProperties,
  };

  if (node.type === 'text') {
    return (
      <NodeFrame node={node} mode={mode} selectedId={selectedId} onSelect={onSelect}>
        <div {...sharedSectionProps}>{String(node.props.text ?? '文本')}</div>
      </NodeFrame>
    );
  }

  if (node.type === 'button') {
    return (
      <NodeFrame node={node} mode={mode} selectedId={selectedId} onSelect={onSelect}>
        <button
          {...sharedSectionProps}
          onClick={(event) => {
            event.stopPropagation();
            if (mode === 'edit') {
              onSelect?.(node.id);
            } else {
              runActions(node);
            }
          }}
        >
          {String(node.props.text ?? '按钮')}
        </button>
      </NodeFrame>
    );
  }

  if (node.type === 'image') {
    return (
      <NodeFrame node={node} mode={mode} selectedId={selectedId} onSelect={onSelect}>
        <img style={node.style as CSSProperties} src={String(node.props.src ?? '')} alt={String(node.props.alt ?? 'image')} />
      </NodeFrame>
    );
  }

  if (node.type === 'hero') {
    return (
      <NodeFrame node={node} mode={mode} selectedId={selectedId} onSelect={onSelect}>
        <section style={node.style as CSSProperties}>
          <div className="hero-title" style={{ fontSize: node.style.fontSize || '34px' }}>{String(node.props.title ?? '')}</div>
          <div className="hero-subtitle">{String(node.props.subtitle ?? '')}</div>
          <div className="hero-note">{String(node.props.note ?? '')}</div>
          <button
            className="hero-cta"
            onClick={(event) => {
              event.stopPropagation();
              if (mode === 'edit') {
                onSelect?.(node.id);
                return;
              }
              runActions(node);
            }}
          >
            {String(node.props.ctaText ?? '立即操作')}
          </button>
        </section>
      </NodeFrame>
    );
  }

  if (node.type === 'feature-list') {
    const items = String(node.props.items ?? '')
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);

    return (
      <NodeFrame node={node} mode={mode} selectedId={selectedId} onSelect={onSelect}>
        <section style={node.style as CSSProperties}>
          <div className="feature-title">{String(node.props.title ?? '卖点列表')}</div>
          <div className="feature-grid">
            {items.map((item, index) => (
              <div key={`${item}-${index}`} className="feature-card">
                <div className="feature-index">{index + 1}</div>
                <div>{item}</div>
              </div>
            ))}
          </div>
        </section>
      </NodeFrame>
    );
  }

  if (node.type === 'stat-grid') {
    const pairs = String(node.props.items ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [value, label] = item.split('|');
        return { value: value?.trim() ?? '', label: label?.trim() ?? '' };
      });

    return (
      <NodeFrame node={node} mode={mode} selectedId={selectedId} onSelect={onSelect}>
        <section style={node.style as CSSProperties}>
          <div className="feature-title">{String(node.props.title ?? '数据指标')}</div>
          <div className="stats-grid">
            {pairs.map((item, index) => (
              <div key={`${item.value}-${index}`} className="stat-card">
                <div className="stat-value">{item.value}</div>
                <div className="stat-label">{item.label}</div>
              </div>
            ))}
          </div>
        </section>
      </NodeFrame>
    );
  }

  if (node.type === 'form') {
    return <FormRenderer node={node} selectedId={selectedId} mode={mode} onSelect={onSelect} />;
  }

  return (
    <NodeFrame node={node} mode={mode} selectedId={selectedId} onSelect={onSelect}>
      <section style={node.style as CSSProperties}>
        {(dragMaterialType || dragNodeId) && mode === 'edit' && (
          <ChildDropZone
            active
            label="插入到容器顶部"
            onDrop={() => {
              if (dragMaterialType) onDropMaterial?.(node.id, 0);
              if (dragNodeId) onDropNode?.(dragNodeId, node.id, 0);
            }}
          />
        )}

        {node.children?.length ? (
          node.children.map((child, index) => (
            <div key={child.id} className="container-child-block">
              <Renderer
                node={child}
                selectedId={selectedId}
                mode={mode}
                onSelect={onSelect}
                dragMaterialType={dragMaterialType}
                dragNodeId={dragNodeId}
                onDropMaterial={onDropMaterial}
                onDropNode={onDropNode}
              />
              {(dragMaterialType || dragNodeId) && mode === 'edit' && (
                <ChildDropZone
                  active
                  label={`插入到容器第 ${index + 1} 个组件后`}
                  onDrop={() => {
                    if (dragMaterialType) onDropMaterial?.(node.id, index + 1);
                    if (dragNodeId) onDropNode?.(dragNodeId, node.id, index + 1);
                  }}
                />
              )}
            </div>
          ))
        ) : (
          <div className="empty-slot">容器支持嵌套，你可以把左侧物料或现有节点直接拖到这里。</div>
        )}
      </section>
    </NodeFrame>
  );
}
