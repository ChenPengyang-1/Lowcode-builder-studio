import { z } from 'zod';

const fieldTypeSchema = z.enum(['text', 'tel', 'email', 'textarea', 'select']);
const sectionTypeSchema = z.enum(['hero', 'feature-list', 'stat-grid', 'image', 'form', 'text']);

export const formFieldSchema = z.object({
  label: z.string().min(1),
  type: fieldTypeSchema,
  placeholder: z.string().default(''),
  required: z.boolean().default(false),
  options: z.array(z.string()).default([]),
});

const heroSectionSchema = z.object({
  kind: z.literal('hero'),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  note: z.string().default(''),
  ctaText: z.string().min(1),
  visualTone: z.enum(['brand', 'dark', 'light', 'enterprise']).default('brand'),
});

const featureListSectionSchema = z.object({
  kind: z.literal('feature-list'),
  title: z.string().min(1),
  items: z.array(z.string().min(1)).min(2).max(6),
});

const statGridSectionSchema = z.object({
  kind: z.literal('stat-grid'),
  title: z.string().min(1),
  items: z.array(z.object({
    value: z.string().min(1),
    label: z.string().min(1),
  })).min(2).max(6),
});

const imageSectionSchema = z.object({
  kind: z.literal('image'),
  alt: z.string().min(1),
  imageTheme: z.enum(['course', 'product', 'recruit', 'business', 'generic']).default('generic'),
  aspect: z.enum(['wide', 'square', 'banner']).default('wide'),
});

const formSectionSchema = z.object({
  kind: z.literal('form'),
  title: z.string().min(1),
  buttonText: z.string().min(1),
  fields: z.array(formFieldSchema).min(2).max(12),
});

const textSectionSchema = z.object({
  kind: z.literal('text'),
  text: z.string().min(1),
  tone: z.enum(['title', 'body', 'note']).default('body'),
});

export const templateBlueprintSchema = z.object({
  pageTitle: z.string().min(1),
  pageDescription: z.string().min(1),
  backgroundTone: z.enum(['light', 'blue', 'dark', 'enterprise']).default('light'),
  summary: z.string().min(1),
  suggestions: z.array(z.string()).max(4).default([]),
  sections: z.array(
    z.discriminatedUnion('kind', [
      heroSectionSchema,
      featureListSectionSchema,
      statGridSectionSchema,
      imageSectionSchema,
      formSectionSchema,
      textSectionSchema,
    ]),
  ).min(2).max(8),
});

export const templateBlueprintFormatName = 'lowcode_template_blueprint';

export const supportedSectionTypes = sectionTypeSchema.options;
