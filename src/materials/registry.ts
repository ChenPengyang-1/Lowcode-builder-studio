import type { FormField, MaterialType, PageNode } from '../types/schema';
import { createId } from '../utils/id';

export interface MaterialMeta {
  type: MaterialType;
  label: string;
  description: string;
  createNode: () => PageNode;
}

function defaultFields(): FormField[] {
  return [
    {
      id: createId('field'),
      label: '手机号',
      type: 'tel',
      placeholder: '请输入手机号',
      required: true,
    },
    {
      id: createId('field'),
      label: '岗位方向',
      type: 'select',
      placeholder: '请选择岗位方向',
      required: true,
      options: ['前端开发', '后端开发', '测试开发'],
    },
  ];
}

export const materialRegistry: MaterialMeta[] = [
  {
    type: 'container',
    label: '容器区块',
    description: '支持嵌套子组件与区块分组。',
    createNode: () => ({
      id: createId('container'),
      type: 'container',
      name: '容器区块',
      props: {},
      style: {
        padding: '24px',
        minHeight: '120px',
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px dashed #cbd5e1',
      },
      children: [],
      visible: true,
      actions: [{ type: 'none' }],
    }),
  },
  {
    type: 'hero',
    label: '主视觉 Hero',
    description: '活动页头部主视觉与 CTA 区。',
    createNode: () => ({
      id: createId('hero'),
      type: 'hero',
      name: '主视觉区',
      props: {
        title: '春季增长计划',
        subtitle: '限时领取增长资源包，快速完成活动报名与信息采集。',
        ctaText: '立即报名',
        note: '支持 Schema 配置驱动、预览交互与动态表单。',
      },
      style: {
        padding: '32px',
        borderRadius: '24px',
        background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
        color: '#ffffff',
        boxShadow: '0 20px 50px rgba(37, 99, 235, 0.25)',
        fontSize: '34px',
      },
      visible: true,
      actions: [{ type: 'alert', payload: '这里可配置为打开表单弹窗或跳转报名页面。' }],
    }),
  },
  {
    type: 'stat-grid',
    label: '指标卡片',
    description: '展示报名人数、转化率、平均停留时长等。',
    createNode: () => ({
      id: createId('stats'),
      type: 'stat-grid',
      name: '数据指标',
      props: {
        title: '活动数据概览',
        items: '2.4W|累计报名,38%|转化率,13min|平均停留时长',
      },
      style: {
        padding: '24px',
        borderRadius: '20px',
        background: '#ffffff',
        border: '1px solid #dbeafe',
      },
      visible: true,
      actions: [{ type: 'none' }],
    }),
  },
  {
    type: 'feature-list',
    label: '卖点列表',
    description: '展示权益、平台亮点或活动卖点。',
    createNode: () => ({
      id: createId('feature'),
      type: 'feature-list',
      name: '卖点区块',
      props: {
        title: '平台亮点',
        items: 'Schema 驱动渲染|拖拽落点插入|动态表单字段配置|预览态交互与结果输出',
      },
      style: {
        padding: '24px',
        borderRadius: '20px',
        background: '#ffffff',
        border: '1px solid #dbeafe',
      },
      visible: true,
      actions: [{ type: 'none' }],
    }),
  },
  {
    type: 'text',
    label: '标题文本',
    description: '适用于标题、说明文案、公告。',
    createNode: () => ({
      id: createId('text'),
      type: 'text',
      name: '标题文本',
      props: {
        text: '这里是一段可配置的标题文本',
      },
      style: {
        fontSize: '28px',
        fontWeight: '700',
        color: '#111827',
        marginBottom: '12px',
      },
      visible: true,
      actions: [{ type: 'none' }],
    }),
  },
  {
    type: 'button',
    label: '行动按钮',
    description: '支持 alert 和 navigate 动作。',
    createNode: () => ({
      id: createId('button'),
      type: 'button',
      name: '行动按钮',
      props: {
        text: '立即操作',
      },
      style: {
        padding: '12px 20px',
        borderRadius: '12px',
        background: '#2563eb',
        color: '#ffffff',
        fontWeight: '600',
        border: 'none',
      },
      visible: true,
      actions: [{ type: 'alert', payload: '这里可配置按钮交互。' }],
    }),
  },
  {
    type: 'image',
    label: '图片 Banner',
    description: '用于主图、海报、横幅。',
    createNode: () => ({
      id: createId('image'),
      type: 'image',
      name: '图片 Banner',
      props: {
        src: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=1200&q=80',
        alt: 'banner',
      },
      style: {
        width: '100%',
        borderRadius: '16px',
        minHeight: '200px',
        objectFit: 'cover',
      },
      visible: true,
      actions: [{ type: 'none' }],
    }),
  },
  {
    type: 'form',
    label: '活动报名表',
    description: '字段可动态增删改，并支持预览态提交。',
    createNode: () => ({
      id: createId('form'),
      type: 'form',
      name: '活动报名表',
      props: {
        title: '活动报名表',
        buttonText: '提交报名',
        fields: defaultFields(),
      },
      style: {
        padding: '24px',
        borderRadius: '20px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
      },
      visible: true,
      actions: [{ type: 'alert', payload: '表单提交成功，结果已输出到页面配置区域。' }],
    }),
  },
];
