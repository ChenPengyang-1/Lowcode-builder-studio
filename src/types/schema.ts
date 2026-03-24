export type MaterialType =
  | 'container'
  | 'text'
  | 'button'
  | 'image'
  | 'form'
  | 'hero'
  | 'feature-list'
  | 'stat-grid';

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'tel' | 'email' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export type ComponentValue = string | number | boolean | string[] | FormField[] | undefined;

export type ComponentProps = {
  [key: string]: ComponentValue;
};

export interface ActionConfig {
  type: 'none' | 'alert' | 'navigate';
  payload?: string;
}

export interface PageNode {
  id: string;
  type: MaterialType;
  name: string;
  props: ComponentProps;
  style: Record<string, string>;
  children?: PageNode[];
  visible?: boolean;
  actions?: ActionConfig[];
}

export interface PageSchema {
  version: string;
  pageMeta: {
    title: string;
    description: string;
    background: string;
  };
  nodes: PageNode[];
}

export interface SavedTemplate {
  id: string;
  name: string;
  draftSchema: PageSchema;
  publishedSchema: PageSchema | null;
  updatedAt: string;
  publishedAt?: string | null;
}
