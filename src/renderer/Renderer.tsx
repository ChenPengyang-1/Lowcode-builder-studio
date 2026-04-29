import { useDraggable } from '@dnd-kit/core';
import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { DropSlot } from '../components/DropSlot';
import { useEditorStore } from '../store/editorStore';
import type { FormField, PageNode } from '../types/schema';

interface RendererProps {
  node: PageNode;
  selectedId?: string | null;
  mode?: 'edit' | 'preview';
  onSelect?: (id: string) => void;
}

function useNodeDraggable(nodeId: string, mode: 'edit' | 'preview') {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `node:${nodeId}:canvas`,
    data: {
      kind: 'node',
      nodeId,
    },
    disabled: mode !== 'edit',
  });

  return {
    dragAttributes: mode === 'edit' ? attributes : undefined,
    dragListeners: mode === 'edit' ? listeners : undefined,
    dragRef: setNodeRef,
    isDragging,
  };
}

function runActions(node: PageNode) {
  const action = node.actions?.[0];
  if (!action || action.type === 'none') return;

  if (action.type === 'alert') {
    window.alert(action.payload || '还没有配置提示内容');
    return;
  }

  if (action.type === 'navigate') {
    if (!action.payload) {
      window.alert('还没有配置跳转链接');
      return;
    }

    window.open(action.payload, '_blank', 'noopener,noreferrer');
  }
}

function splitFeatureItems(value: unknown) {
  return String(value ?? '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitStatItems(value: unknown) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [metric = '', label = ''] = item.split('|');
      return {
        value: metric.trim(),
        label: label.trim(),
      };
    });
}

function renderFormField(
  field: FormField,
  value: string,
  interactive: boolean,
  error: string | undefined,
  onChange: (nextValue: string) => void,
) {
  if (field.type === 'textarea') {
    return (
      <textarea
        className="mock-input"
        placeholder={field.placeholder || field.label}
        rows={3}
        readOnly={!interactive}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        className="mock-input"
        disabled={!interactive}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{field.placeholder || `请选择${field.label}`}</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  const inputType = field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text';

  return (
    <input
      className="mock-input"
      placeholder={field.placeholder || field.label}
      readOnly={!interactive}
      type={inputType}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

const FormRenderer = memo(function FormRenderer({
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
  const { dragAttributes, dragListeners, dragRef, isDragging } = useNodeDraggable(node.id, mode);

  const initialValues = useMemo(() => {
    const nextValues: Record<string, string> = {};
    fields.forEach((field) => {
      nextValues[field.id] = '';
    });
    return nextValues;
  }, [fields]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  const updateValue = (fieldId: string, nextValue: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: nextValue }));
  };

  const handleSubmit = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (mode === 'edit') {
      onSelect?.(node.id);
      return;
    }

    const nextErrors: Record<string, string> = {};

    fields.forEach((field) => {
      const currentValue = values[field.id]?.trim() ?? '';

      if (field.required && !currentValue) {
        nextErrors[field.id] = `${field.label}为必填项`;
      }

      if (field.type === 'tel' && currentValue && !/^1\d{10}$/.test(currentValue)) {
        nextErrors[field.id] = '手机号格式不正确';
      }

      if (field.type === 'email' && currentValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentValue)) {
        nextErrors[field.id] = '邮箱格式不正确';
      }
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    submitForm({
      formId: node.id,
      formTitle: String(node.props.title ?? '未命名表单'),
      submittedAt: new Date().toISOString(),
      values: fields.reduce<Record<string, string>>((result, field) => {
        result[field.label] = values[field.id] ?? '';
        return result;
      }, {}),
    });

    runActions(node);
    window.alert('提交成功，结果已经写到右侧“最近提交结果”区域。');
  };

  return (
    <div
      ref={dragRef}
      style={node.style as CSSProperties}
      onClick={(event) => {
        event.stopPropagation();
        if (mode === 'edit') onSelect?.(node.id);
      }}
      className={`${selectedId === node.id && mode === 'edit' ? 'selected-node' : ''} ${isDragging ? 'dragging-node' : ''}`.trim()}
      {...dragListeners}
      {...dragAttributes}
    >
      <div className="form-title">{String(node.props.title ?? '表单')}</div>

      <div className="form-grid">
        {fields.map((field, index) => (
          <div
            key={field.id || `${field.label}-${index}`}
            className={`form-field-card ${field.type === 'textarea' ? 'full' : ''}`}
          >
            <div className="form-field-label">
              {field.label}
              {field.required ? <span className="required-dot">*</span> : null}
            </div>
            {renderFormField(
              field,
              values[field.id] ?? '',
              interactive,
              errors[field.id],
              (nextValue) => updateValue(field.id, nextValue),
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
});

const NodeFrame = memo(function NodeFrame({
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
  const { dragAttributes, dragListeners, dragRef, isDragging } = useNodeDraggable(node.id, mode);

  return (
    <div
      ref={dragRef}
      className={`${selectedId === node.id && mode === 'edit' ? 'selected-node' : ''} ${isDragging ? 'dragging-node' : ''} node-draggable-shell`.trim()}
      onClick={(event) => {
        event.stopPropagation();
        if (mode === 'edit') onSelect?.(node.id);
      }}
      {...dragListeners}
      {...dragAttributes}
    >
      {mode === 'edit' ? <div className="drag-handle-badge">拖动重排</div> : null}
      {children}
    </div>
  );
});

function renderContainerChildren(
  node: PageNode,
  selectedId: string | null | undefined,
  mode: 'edit' | 'preview',
  onSelect?: (id: string) => void,
) {
  if (!node.children?.length) {
    return (
      <>
        <div className="empty-slot">容器支持嵌套，你可以把左侧物料或现有节点直接拖到这里。</div>
        {mode === 'edit' ? (
          <DropSlot parentId={node.id} index={0} position="inside" label="拖到这里放进容器" className="child-drop-slot" />
        ) : null}
      </>
    );
  }

  return (
    <>
      {mode === 'edit' ? (
        <DropSlot parentId={node.id} index={0} position="inside" label="插入到容器顶部" className="child-drop-slot" />
      ) : null}

      {node.children.map((child, index) => (
        <div key={child.id} className="container-child-block">
          <Renderer node={child} selectedId={selectedId} mode={mode} onSelect={onSelect} />
          {mode === 'edit' ? (
            <DropSlot
              parentId={node.id}
              index={index + 1}
              position="inside"
              label={`插入到容器第 ${index + 1} 个组件后`}
              className="child-drop-slot"
            />
          ) : null}
        </div>
      ))}
    </>
  );
}

export function Renderer({ node, selectedId, mode = 'edit', onSelect }: RendererProps) {
  if (node.visible === false) return null;

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
              return;
            }
            runActions(node);
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
        <img
          style={node.style as CSSProperties}
          src={String(node.props.src ?? '')}
          alt={String(node.props.alt ?? 'image')}
        />
      </NodeFrame>
    );
  }

  if (node.type === 'hero') {
    return (
      <NodeFrame node={node} mode={mode} selectedId={selectedId} onSelect={onSelect}>
        <section style={node.style as CSSProperties}>
          <div className="hero-title" style={{ fontSize: node.style.fontSize || '34px' }}>
            {String(node.props.title ?? '')}
          </div>
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
    const items = splitFeatureItems(node.props.items);

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
    const pairs = splitStatItems(node.props.items);

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
        {renderContainerChildren(node, selectedId, mode, onSelect)}
      </section>
    </NodeFrame>
  );
}
