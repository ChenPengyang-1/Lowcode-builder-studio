import type { FormField, PageNode, PageSchema, SavedTemplate } from '../types/schema';

export interface ExportedFileAsset {
  filename: string;
  content: string;
  mimeType: string;
}

function sanitizeFilenamePart(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'page';
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toKebabCase(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function styleObjectToCss(style: Record<string, string> | undefined) {
  if (!style) return '';
  return Object.entries(style)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([key, value]) => `${toKebabCase(key)}:${value}`)
    .join(';');
}

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function buildActionAttribute(node: PageNode) {
  const action = node.actions?.[0];
  if (!action || action.type === 'none') return '';

  if (action.type === 'navigate' && action.payload) {
    return ` data-action="navigate" data-payload="${escapeHtml(action.payload)}"`;
  }

  if (action.type === 'alert' && action.payload) {
    return ` data-action="alert" data-payload="${escapeHtml(action.payload)}"`;
  }

  return '';
}

function parseFeatureItems(value: unknown) {
  return String(value ?? '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseStatItems(value: unknown) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [statValue, statLabel] = item.split('|');
      return {
        value: statValue?.trim() ?? '',
        label: statLabel?.trim() ?? '',
      };
    });
}

function renderFormField(field: FormField) {
  const label = escapeHtml(field.label);
  const placeholder = escapeHtml(field.placeholder || field.label);
  const required = field.required ? '<span class="required-dot">*</span>' : '';
  const errorText = field.required ? '<div class="export-form-hint">此项为必填字段</div>' : '';

  if (field.type === 'textarea') {
    return `
      <div class="export-form-field export-form-field-full">
        <label>${label}${required}</label>
        <textarea placeholder="${placeholder}" rows="4"></textarea>
        ${errorText}
      </div>
    `;
  }

  if (field.type === 'select') {
    const options = (field.options ?? [])
      .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
      .join('');
    return `
      <div class="export-form-field">
        <label>${label}${required}</label>
        <select>
          <option value="">${placeholder}</option>
          ${options}
        </select>
        ${errorText}
      </div>
    `;
  }

  const type = field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text';
  return `
    <div class="export-form-field">
      <label>${label}${required}</label>
      <input type="${type}" placeholder="${placeholder}" />
      ${errorText}
    </div>
  `;
}

function renderNode(node: PageNode): string {
  if (node.visible === false) return '';

  const inlineStyle = styleObjectToCss(node.style);
  const styleAttr = inlineStyle ? ` style="${escapeHtml(inlineStyle)}"` : '';
  const actionAttr = buildActionAttribute(node);

  if (node.type === 'text') {
    return `<div class="export-text-node"${styleAttr}>${escapeHtml(node.props.text ?? node.name)}</div>`;
  }

  if (node.type === 'button') {
    return `<button class="export-button-node"${styleAttr}${actionAttr}>${escapeHtml(node.props.text ?? '按钮')}</button>`;
  }

  if (node.type === 'image') {
    return `
      <img
        class="export-image-node"
        src="${escapeHtml(node.props.src ?? '')}"
        alt="${escapeHtml(node.props.alt ?? node.name)}"
        loading="lazy"
        ${styleAttr}
      />
    `;
  }

  if (node.type === 'hero') {
    return `
      <section class="export-hero-node"${styleAttr}>
        <div class="export-hero-title">${escapeHtml(node.props.title ?? '')}</div>
        <div class="export-hero-subtitle">${escapeHtml(node.props.subtitle ?? '')}</div>
        <div class="export-hero-note">${escapeHtml(node.props.note ?? '')}</div>
        <button class="export-hero-cta"${actionAttr}>${escapeHtml(node.props.ctaText ?? '立即操作')}</button>
      </section>
    `;
  }

  if (node.type === 'feature-list') {
    const items = parseFeatureItems(node.props.items)
      .map(
        (item, index) => `
          <article class="export-feature-card">
            <span class="export-feature-index">${index + 1}</span>
            <div>${escapeHtml(item)}</div>
          </article>
        `,
      )
      .join('');

    return `
      <section class="export-section-block"${styleAttr}>
        <h2 class="export-section-title">${escapeHtml(node.props.title ?? '页面亮点')}</h2>
        <div class="export-feature-grid">${items}</div>
      </section>
    `;
  }

  if (node.type === 'stat-grid') {
    const items = parseStatItems(node.props.items)
      .map(
        (item) => `
          <article class="export-stat-card">
            <div class="export-stat-value">${escapeHtml(item.value)}</div>
            <div class="export-stat-label">${escapeHtml(item.label)}</div>
          </article>
        `,
      )
      .join('');

    return `
      <section class="export-section-block"${styleAttr}>
        <h2 class="export-section-title">${escapeHtml(node.props.title ?? '数据指标')}</h2>
        <div class="export-stat-grid">${items}</div>
      </section>
    `;
  }

  if (node.type === 'form') {
    const fields = ((node.props.fields as FormField[] | undefined) ?? []).map(renderFormField).join('');
    return `
      <section class="export-section-block export-form-block"${styleAttr}>
        <h2 class="export-section-title">${escapeHtml(node.props.title ?? '表单')}</h2>
        <div class="export-form-grid">${fields}</div>
        <button class="export-form-submit"${actionAttr}>${escapeHtml(node.props.buttonText ?? '提交')}</button>
      </section>
    `;
  }

  const children = (node.children ?? []).map((child) => renderNode(child)).join('');
  return `<section class="${joinClassNames('export-section-block', node.type === 'container' && 'export-container-node')}"${styleAttr}>${children}</section>`;
}

function buildStandaloneHtml(schema: PageSchema, templateName: string) {
  const pageTitle = escapeHtml(schema.pageMeta.title || templateName);
  const pageDescription = escapeHtml(schema.pageMeta.description || '');
  const pageBackground = escapeHtml(schema.pageMeta.background || '#f8fafc');
  const nodesHtml = schema.nodes.map((node) => renderNode(node)).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${pageTitle}</title>
    <meta name="description" content="${pageDescription}" />
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-width: 320px;
        background: ${pageBackground};
        color: #0f172a;
      }

      .export-page {
        width: min(1180px, calc(100% - 32px));
        margin: 0 auto;
        padding: 40px 0 72px;
      }

      .export-page-head {
        margin-bottom: 22px;
      }

      .export-page-head h1 {
        margin: 0;
        font-size: 40px;
        line-height: 1.08;
      }

      .export-page-head p {
        margin: 12px 0 0;
        max-width: 820px;
        color: #475569;
        line-height: 1.7;
      }

      .export-content {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .export-section-block,
      .export-hero-node {
        border-radius: 24px;
        border: 1px solid rgba(191, 219, 254, 0.8);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
        box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
        padding: 22px;
      }

      .export-hero-title {
        font-size: clamp(34px, 5vw, 56px);
        font-weight: 800;
        line-height: 1.14;
        margin-bottom: 14px;
      }

      .export-hero-subtitle {
        font-size: 18px;
        color: #1e3a8a;
        margin-bottom: 10px;
      }

      .export-hero-note {
        color: #475569;
        line-height: 1.7;
        margin-bottom: 22px;
      }

      .export-hero-cta,
      .export-button-node,
      .export-form-submit {
        border: none;
        border-radius: 16px;
        padding: 14px 22px;
        font-size: 16px;
        font-weight: 700;
        background: linear-gradient(135deg, #2563eb, #4f46e5);
        color: white;
        box-shadow: 0 14px 28px rgba(37, 99, 235, 0.2);
      }

      .export-button-node { display: inline-flex; align-items: center; justify-content: center; }

      .export-section-title {
        margin: 0 0 16px;
        font-size: 28px;
        line-height: 1.2;
      }

      .export-feature-grid,
      .export-stat-grid,
      .export-form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .export-feature-card,
      .export-stat-card,
      .export-form-field {
        border-radius: 18px;
        border: 1px solid rgba(191, 219, 254, 0.82);
        background: rgba(255, 255, 255, 0.92);
        padding: 16px;
      }

      .export-feature-card {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        color: #334155;
      }

      .export-feature-index {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #dbeafe;
        color: #1d4ed8;
        font-weight: 700;
        flex-shrink: 0;
      }

      .export-stat-value {
        font-size: 34px;
        font-weight: 800;
        color: #1d4ed8;
      }

      .export-stat-label {
        margin-top: 6px;
        color: #475569;
      }

      .export-text-node {
        font-size: 16px;
        line-height: 1.7;
        color: #334155;
      }

      .export-image-node {
        display: block;
        max-width: 100%;
        border-radius: 18px;
      }

      .export-form-field label {
        display: block;
        margin-bottom: 8px;
        font-weight: 700;
      }

      .required-dot {
        margin-left: 4px;
        color: #dc2626;
      }

      .export-form-field input,
      .export-form-field textarea,
      .export-form-field select {
        width: 100%;
        border-radius: 14px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        padding: 12px 14px;
        font: inherit;
        background: #fff;
      }

      .export-form-field-full {
        grid-column: 1 / -1;
      }

      .export-form-hint {
        margin-top: 8px;
        font-size: 12px;
        color: #64748b;
      }

      .export-container-node {
        background: rgba(255, 255, 255, 0.72);
      }

      @media (max-width: 768px) {
        .export-page {
          width: min(100% - 24px, 100%);
          padding: 24px 0 48px;
        }

        .export-page-head h1 {
          font-size: 32px;
        }

        .export-feature-grid,
        .export-stat-grid,
        .export-form-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="export-page">
      <header class="export-page-head">
        <h1>${pageTitle}</h1>
        <p>${pageDescription}</p>
      </header>
      <section class="export-content">
        ${nodesHtml}
      </section>
    </main>
    <script>
      document.querySelectorAll('[data-action]').forEach((element) => {
        element.addEventListener('click', () => {
          const action = element.getAttribute('data-action');
          const payload = element.getAttribute('data-payload') || '';
          if (action === 'navigate' && payload) {
            window.open(payload, '_blank', 'noopener,noreferrer');
          } else if (action === 'alert' && payload) {
            window.alert(payload);
          }
        });
      });
    </script>
  </body>
</html>`;
}

export function buildStandalonePageAsset(template: SavedTemplate): ExportedFileAsset {
  const schema = template.publishedSchema ?? template.draftSchema;
  const safeName = sanitizeFilenamePart(template.name);
  return {
    filename: `${safeName}.html`,
    content: buildStandaloneHtml(schema, template.name),
    mimeType: 'text/html;charset=utf-8',
  };
}
