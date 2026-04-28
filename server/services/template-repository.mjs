import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = path.resolve(process.cwd(), 'server', 'data');
const dbPath = path.join(dataDir, 'templates.sqlite');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function countNodes(nodes = []) {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children ?? []), 0);
}

function toJson(value) {
  return JSON.stringify(value);
}

function parseJson(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export class TemplateRepository {
  constructor() {
    ensureDataDir();
    this.db = new DatabaseSync(dbPath);
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source TEXT,
        draft_schema TEXT NOT NULL,
        published_schema TEXT,
        updated_at TEXT NOT NULL,
        published_at TEXT,
        thumbnail_url TEXT,
        draft_node_count INTEGER NOT NULL DEFAULT 0,
        published_node_count INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  buildSummary(row) {
    return {
      id: row.id,
      name: row.name,
      source: row.source ?? undefined,
      updatedAt: row.updated_at,
      publishedAt: row.published_at ?? null,
      hasPublished: Boolean(row.published_schema),
      draftNodeCount: Number(row.draft_node_count ?? 0),
      publishedNodeCount: Number(row.published_node_count ?? 0),
      thumbnailUrl: row.thumbnail_url ?? null,
    };
  }

  buildTemplate(row) {
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      source: row.source ?? undefined,
      draftSchema: parseJson(row.draft_schema, null),
      publishedSchema: row.published_schema ? parseJson(row.published_schema, null) : null,
      updatedAt: row.updated_at,
      publishedAt: row.published_at ?? null,
    };
  }

  listSummaries() {
    const rows = this.db
      .prepare(`
        SELECT
          id,
          name,
          source,
          updated_at,
          published_at,
          thumbnail_url,
          published_schema,
          draft_node_count,
          published_node_count
        FROM templates
        ORDER BY updated_at DESC
      `)
      .all();

    return rows.map((row) => this.buildSummary(row));
  }

  getTemplate(templateId) {
    const row = this.db
      .prepare(`
        SELECT
          id,
          name,
          source,
          draft_schema,
          published_schema,
          updated_at,
          published_at
        FROM templates
        WHERE id = ?
      `)
      .get(templateId);

    return this.buildTemplate(row);
  }

  createTemplate(template) {
    const draftNodeCount = countNodes(template.draftSchema?.nodes ?? []);
    const publishedNodeCount = template.publishedSchema
      ? countNodes(template.publishedSchema.nodes ?? [])
      : 0;

    this.db
      .prepare(`
        INSERT INTO templates (
          id,
          name,
          source,
          draft_schema,
          published_schema,
          updated_at,
          published_at,
          thumbnail_url,
          draft_node_count,
          published_node_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        template.id,
        template.name,
        template.source ?? null,
        toJson(template.draftSchema),
        template.publishedSchema ? toJson(template.publishedSchema) : null,
        template.updatedAt,
        template.publishedAt ?? null,
        template.thumbnailUrl ?? null,
        draftNodeCount,
        publishedNodeCount,
      );

    return this.getTemplate(template.id);
  }

  updateDraft(templateId, schema) {
    const existing = this.getTemplate(templateId);
    if (!existing) return null;

    const updatedAt = new Date().toISOString();
    const draftNodeCount = countNodes(schema?.nodes ?? []);

    this.db
      .prepare(`
        UPDATE templates
        SET draft_schema = ?, updated_at = ?, draft_node_count = ?
        WHERE id = ?
      `)
      .run(toJson(schema), updatedAt, draftNodeCount, templateId);

    return this.getTemplate(templateId);
  }

  publishTemplate(templateId, schema) {
    const existing = this.getTemplate(templateId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const draftNodeCount = countNodes(schema?.nodes ?? []);
    const publishedNodeCount = draftNodeCount;

    this.db
      .prepare(`
        UPDATE templates
        SET
          draft_schema = ?,
          published_schema = ?,
          updated_at = ?,
          published_at = ?,
          draft_node_count = ?,
          published_node_count = ?
        WHERE id = ?
      `)
      .run(
        toJson(schema),
        toJson(schema),
        now,
        now,
        draftNodeCount,
        publishedNodeCount,
        templateId,
      );

    return this.getTemplate(templateId);
  }

  renameTemplate(templateId, name) {
    const updatedAt = new Date().toISOString();

    const result = this.db
      .prepare(`
        UPDATE templates
        SET name = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(name, updatedAt, templateId);

    if (!result.changes) {
      return null;
    }

    const row = this.db
      .prepare(`
        SELECT
          id,
          name,
          source,
          updated_at,
          published_at,
          thumbnail_url,
          published_schema,
          draft_node_count,
          published_node_count
        FROM templates
        WHERE id = ?
      `)
      .get(templateId);

    return this.buildSummary(row);
  }

  deleteTemplate(templateId) {
    const result = this.db.prepare(`DELETE FROM templates WHERE id = ?`).run(templateId);
    return result.changes > 0;
  }

  countTemplates() {
    const row = this.db.prepare(`SELECT COUNT(*) AS total FROM templates`).get();
    return Number(row?.total ?? 0);
  }

  bootstrapTemplates(templates) {
    if (this.countTemplates() > 0) {
      return this.listSummaries();
    }

    const insert = this.db.prepare(`
      INSERT INTO templates (
        id,
        name,
        source,
        draft_schema,
        published_schema,
        updated_at,
        published_at,
        thumbnail_url,
        draft_node_count,
        published_node_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((records) => {
      records.forEach((template) => {
        const draftNodeCount = countNodes(template.draftSchema?.nodes ?? []);
        const publishedNodeCount = template.publishedSchema
          ? countNodes(template.publishedSchema.nodes ?? [])
          : 0;

        insert.run(
          template.id,
          template.name,
          template.source ?? null,
          toJson(template.draftSchema),
          template.publishedSchema ? toJson(template.publishedSchema) : null,
          template.updatedAt,
          template.publishedAt ?? null,
          template.thumbnailUrl ?? null,
          draftNodeCount,
          publishedNodeCount,
        );
      });
    });

    transaction(templates);
    return this.listSummaries();
  }
}

export const templateRepository = new TemplateRepository();
