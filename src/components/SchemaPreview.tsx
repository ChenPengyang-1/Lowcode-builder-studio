import { Renderer } from '../renderer/Renderer';
import type { PageSchema } from '../types/schema';

interface SchemaPreviewProps {
  schema: PageSchema;
  title?: string;
  description?: string;
}

export function SchemaPreview({ schema, title, description }: SchemaPreviewProps) {
  return (
    <section className="published-preview-shell">
      {title ? <div className="published-preview-title">{title}</div> : null}
      {description ? <div className="published-preview-description">{description}</div> : null}
      <div className="published-preview-canvas" style={{ background: schema.pageMeta.background }}>
        {schema.nodes.map((node) => (
          <Renderer key={node.id} node={node} mode="preview" />
        ))}
      </div>
    </section>
  );
}
