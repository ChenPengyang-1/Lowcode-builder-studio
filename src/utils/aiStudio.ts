import type { FormField, PageNode, PageSchema } from '../types/schema';
import { createId } from './id';

export interface AiTemplateResult {
  schema: PageSchema;
  summary: string;
  suggestions: string[];
}

function cloneSchema<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function normalizePrompt(input: string) {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

function makeField(label: string, type: FormField['type'], required = false, options?: string[]): FormField {
  return {
    id: createId('field'),
    label,
    type,
    required,
    placeholder: `请输入${label}`,
    options,
  };
}

function dedupeFields(fields: FormField[]) {
  return fields.filter((field, index, list) => list.findIndex((item) => item.label === field.label) === index);
}

function moveNodeToFront(nodes: PageNode[], type: PageNode['type']) {
  const index = nodes.findIndex((node) => node.type === type);
  if (index <= 0) return nodes;

  const next = [...nodes];
  const [target] = next.splice(index, 1);
  next.unshift(target);
  return next;
}

function moveNodeAfterType(nodes: PageNode[], targetType: PageNode['type'], anchorType: PageNode['type']) {
  const targetIndex = nodes.findIndex((node) => node.type === targetType);
  const anchorIndex = nodes.findIndex((node) => node.type === anchorType);
  if (targetIndex === -1 || anchorIndex === -1 || targetIndex === anchorIndex + 1) return nodes;

  const next = [...nodes];
  const [target] = next.splice(targetIndex, 1);
  const currentAnchorIndex = next.findIndex((node) => node.type === anchorType);
  next.splice(currentAnchorIndex + 1, 0, target);
  return next;
}

function buildCoreFields(prompt: string, richer = false) {
  const fields: FormField[] = [
    makeField('姓名', 'text', true),
    makeField('手机号', 'tel', true),
    makeField('邮箱', 'email'),
  ];

  if (hasAny(prompt, ['企业', '公司', 'to b', 'b端'])) {
    fields.push(makeField('公司名称', 'text', true));
    fields.push(makeField('职位', 'text'));
    fields.push(makeField('公司规模', 'select', false, ['1-50人', '50-200人', '200-1000人', '1000人以上']));
  }

  if (hasAny(prompt, ['课程', '培训', '学习', '试听'])) {
    fields.push(makeField('学习方向', 'select', true, ['前端工程化', 'AI 应用', '产品设计', '数据分析']));
    fields.push(makeField('学习目标', 'textarea'));
  }

  if (richer || hasAny(prompt, ['详细', '更多字段', '表单信息更详细', '丰富一点'])) {
    fields.push(makeField('预算范围', 'select', false, ['5k以下', '5k-2w', '2w-5w', '5w以上']));
    fields.push(makeField('当前需求', 'textarea'));
  }

  return dedupeFields(fields);
}

function makeHero(title: string, subtitle: string, darkMode: boolean): PageNode {
  return {
    id: createId('hero'),
    type: 'hero',
    name: title,
    props: {
      title,
      subtitle,
      note: '该页面由引导模式生成，可继续进入编辑器精修。',
      ctaText: '立即咨询',
    },
    style: {
      padding: '36px',
      borderRadius: '28px',
      background: darkMode
        ? 'linear-gradient(135deg, #08101f 0%, #13233f 52%, #2352cc 100%)'
        : 'linear-gradient(135deg, #2563eb 0%, #7dd3fc 100%)',
      color: '#ffffff',
      boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
      fontSize: '36px',
    },
    visible: true,
    actions: [{ type: 'none' }],
  };
}

function makeFeatureList(title: string, items: string[], minimalist: boolean): PageNode {
  return {
    id: createId('feature'),
    type: 'feature-list',
    name: title,
    props: {
      title,
      items: items.join('|'),
    },
    style: {
      padding: minimalist ? '20px' : '24px',
      borderRadius: '22px',
      background: '#ffffff',
      border: '1px solid #dbeafe',
    },
    visible: true,
    actions: [{ type: 'none' }],
  };
}

function makeStatGrid(title: string, items: string[]): PageNode {
  return {
    id: createId('stats'),
    type: 'stat-grid',
    name: title,
    props: {
      title,
      items: items.join(','),
    },
    style: {
      padding: '24px',
      borderRadius: '22px',
      background: '#ffffff',
      border: '1px solid #dbeafe',
    },
    visible: true,
    actions: [{ type: 'none' }],
  };
}

function makeImage(prompt: string, index: number): PageNode {
  const width = index === 0 ? 1400 : 1200;
  const src = hasAny(prompt, ['社团', '迎新', '活动'])
    ? `https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=${width}&q=80`
    : hasAny(prompt, ['课程', '学习', '培训'])
    ? `https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=${width}&q=80`
    : hasAny(prompt, ['产品', '科技', 'saas'])
      ? `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=${width}&q=80`
      : `https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=${width}&q=80`;

  return {
    id: createId('image'),
    type: 'image',
    name: `展示图片${index + 1}`,
    props: {
      src,
      alt: `展示图片${index + 1}`,
    },
    style: {
      width: '100%',
      minHeight: index === 0 ? '240px' : '220px',
      borderRadius: '22px',
      objectFit: 'cover',
    },
    visible: true,
    actions: [{ type: 'none' }],
  };
}

function makeText(text: string, tone: 'title' | 'body' = 'body'): PageNode {
  return {
    id: createId('text'),
    type: 'text',
    name: text.slice(0, 12),
    props: { text },
    style: {
      fontSize: tone === 'title' ? '28px' : '18px',
      fontWeight: tone === 'title' ? '700' : '400',
      color: '#0f172a',
      marginBottom: '12px',
    },
    visible: true,
    actions: [{ type: 'none' }],
  };
}

function makeForm(title: string, buttonText: string, fields: FormField[]): PageNode {
  return {
    id: createId('form'),
    type: 'form',
    name: title,
    props: {
      title,
      buttonText,
      fields,
    },
    style: {
      padding: '24px',
      borderRadius: '22px',
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
    },
    visible: true,
    actions: [{ type: 'alert', payload: '表单已提交，可继续接入真实业务流程。' }],
  };
}

function createFaqNode(): PageNode {
  return makeFeatureList('常见问题', ['多久可以开始使用|是否支持继续自定义|是否可以复用模板'], false);
}

function summarizeType(type: string) {
  const labels: Record<string, string> = {
    hero: '主视觉',
    'feature-list': '亮点区',
    'stat-grid': '数据区',
    form: '表单',
    image: '图片',
    text: '文本',
  };
  return labels[type] ?? type;
}

export function summarizeSchema(schema: PageSchema) {
  const counts = schema.nodes.reduce(
    (acc, node) => {
      acc[node.type] = (acc[node.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const parts = Object.entries(counts).map(([type, count]) => `${summarizeType(type)} x${count}`);
  return `当前模板“${schema.pageMeta.title}”包含 ${parts.join('、')}。`;
}

export function generateTemplateFromPrompt(rawPrompt: string): AiTemplateResult {
  const prompt = normalizePrompt(rawPrompt);
  const minimalist = hasAny(prompt, ['极简', '简洁', 'minimal']);
  const darkMode = hasAny(prompt, ['深色', '暗色', 'dark', '科技']);
  const isCourse = hasAny(prompt, ['课程', '培训', '学习', '试听']);
  const isProduct = hasAny(prompt, ['产品', '发布', 'saas']);
  const isRecruit = hasAny(prompt, ['招聘', '校招', '春招']);
  const includeImage = isProduct || hasAny(prompt, ['图片', '海报', '视觉', 'banner']);
  const extraImageCount = hasAny(prompt, ['多一张图片', '再来一张图片', '再多一张图片']) ? 1 : 0;
  const addAnotherForm = hasAny(prompt, ['再加一个表单', '第二个表单', '额外表单']);
  const includeFaq = hasAny(prompt, ['faq', '问答', '常见问题']);
  const needsStats = !hasAny(prompt, ['不要数据区', '不要数据']);

  let pageTitle = '生成的营销页模板';
  let pageDescription = '根据当前需求生成的页面草稿，可继续进入编辑器修改。';
  let heroTitle = '让页面搭建从灵感走向可复用模板';
  let heroSubtitle = '围绕页面目标、目标用户和模块诉求，自动生成一版可继续编辑的落地页草稿。';
  let featureTitle = '页面亮点';
  let featureItems = ['支持组件拖拽编排', '支持模板保存与发布', '支持通过对话继续调整'];
  let statTitle = '推荐指标';
  let statItems = ['10min|生成首版页面', '3类|典型场景支持', '2倍|模板复用效率'];
  let formTitle = '获取详细方案';
  let formButton = '立即咨询';

  if (isCourse) {
    pageTitle = '生成的课程报名页';
    pageDescription = '适合试听报名、训练营招生和课程转化的课程页草稿。';
    heroTitle = '把课程价值讲清楚，让报名转化更顺畅';
    heroSubtitle = '自动生成课程亮点、学习收获、数据展示和报名表单，适合课程推广与留资转化。';
    featureTitle = '课程亮点';
    featureItems = ['从试听到正式报名链路清晰', '突出课程收获与适合人群', '支持继续增强表单信息收集'];
    statTitle = '课程数据';
    statItems = ['1200+|累计报名', '4.9/5|课程评分', '87%|完课率'];
    formTitle = '领取试听名额';
    formButton = '立即预约';
  } else if (isProduct) {
    pageTitle = '生成的产品介绍页';
    pageDescription = '适合产品介绍、功能上线和线索收集的发布页草稿。';
    heroTitle = '把产品能力讲明白，让意向用户更快行动';
    heroSubtitle = '自动生成主视觉、能力亮点、数据区和预约表单，适合产品发布与线索转化。';
    featureTitle = '核心能力';
    featureItems = ['亮点信息一屏可读', '模板与发布链路统一管理', '支持 AI 辅助快速迭代'];
    statTitle = '上线效果';
    statItems = ['10min|产出首版页面', '3类|典型模板沉淀', '2倍|复用效率提升'];
    formTitle = '预约产品演示';
    formButton = '提交预约';
  } else if (isRecruit) {
    pageTitle = '生成的招聘专题页';
    pageDescription = '适合招聘活动、校招专题和岗位宣传的页面草稿。';
    heroTitle = '加入一支真正重视成长与反馈的团队';
    heroSubtitle = '自动生成岗位亮点、团队数据和投递表单，适合校园招聘和岗位专题运营。';
    featureTitle = '加入我们的理由';
    featureItems = ['岗位价值表达更清晰', '团队文化和成长路径可视化', '更方便导入真实投递收集流程'];
    statTitle = '团队概览';
    statItems = ['80+|在招岗位', '92%|转正留存率', '12座|办公地点'];
    formTitle = '投递信息';
    formButton = '提交投递';
  }

  const nodes: PageNode[] = [makeHero(heroTitle, heroSubtitle, darkMode)];

  if (includeImage) {
    nodes.push(makeImage(prompt, 0));
    for (let index = 0; index < extraImageCount; index += 1) {
      nodes.push(makeImage(prompt, index + 1));
    }
  }

  nodes.push(makeFeatureList(featureTitle, featureItems, minimalist));

  if (needsStats) {
    nodes.push(makeStatGrid(statTitle, statItems));
  }

  nodes.push(makeForm(formTitle, formButton, buildCoreFields(prompt, false)));

  if (addAnotherForm) {
    nodes.push(makeForm('深度咨询信息收集', '提交详细需求', buildCoreFields(prompt, true)));
  }

  if (includeFaq) {
    nodes.push(createFaqNode());
  }

  return {
    schema: {
      version: '3.0.0',
      pageMeta: {
        title: pageTitle,
        description: pageDescription,
        background: darkMode
          ? 'linear-gradient(180deg, #0b1220 0%, #111c34 100%)'
          : 'linear-gradient(180deg, #f5f9ff 0%, #eef6ff 100%)',
      },
      nodes,
    },
    summary: `已根据“${rawPrompt.trim()}”生成一版页面草稿。`,
    suggestions: ['你可以继续补充配色、表单字段或区块增减。'],
  };
}

export function refineTemplateFromPrompt(baseSchema: PageSchema, rawPrompt: string): AiTemplateResult {
  const prompt = normalizePrompt(rawPrompt);
  const schema = cloneSchema(baseSchema);
  let nodes = [...schema.nodes];
  const summaryParts: string[] = [];
  const suggestions: string[] = [];

  if (hasAny(prompt, ['再加一个表单', '增加表单'])) {
    nodes.push(makeForm('补充信息收集', '提交需求', buildCoreFields(prompt, true)));
    summaryParts.push('新增了一张表单');
  }

  if (hasAny(prompt, ['多一张图片', '增加图片'])) {
    const imageCount = nodes.filter((node) => node.type === 'image').length;
    nodes.push(makeImage(prompt, imageCount));
    summaryParts.push('新增了一张图片');
  }

  if (hasAny(prompt, ['活动图', '活动图片', '社团活动', '迎新照片', '活动照片'])) {
    const imageCount = nodes.filter((node) => node.type === 'image').length;
    nodes.push(makeImage(`${prompt} 社团 活动`, imageCount));
    summaryParts.push('补充了更贴近活动场景的展示图片');
  }

  if (hasAny(prompt, ['faq', '常见问题', '问答'])) {
    nodes.push(createFaqNode());
    summaryParts.push('补充了 FAQ 区块');
  }

  if (hasAny(prompt, ['删除faq', '去掉faq', '不要faq', '删掉faq', '删除常见问题', '去掉常见问题'])) {
    const nextNodes = nodes.filter((node) => !(node.type === 'feature-list' && String(node.props.title ?? '').includes('常见问题')));
    if (nextNodes.length !== nodes.length) {
      nodes = nextNodes;
      summaryParts.push('移除了 FAQ 区块');
    }
  }

  if (hasAny(prompt, ['简洁', '极简'])) {
    nodes = nodes.map((node) => ({
      ...node,
      style: {
        ...node.style,
        borderRadius: node.type === 'hero' ? '24px' : '18px',
        boxShadow: 'none',
      },
    }));
    summaryParts.push('整体风格调整得更简洁');
  }

  if (hasAny(prompt, ['深色', '科技', '暗色'])) {
    schema.pageMeta.background = 'linear-gradient(180deg, #0b1220 0%, #111c34 100%)';
    nodes = nodes.map((node) =>
      node.type === 'hero'
        ? {
            ...node,
            style: {
              ...node.style,
              background: 'linear-gradient(135deg, #08101f 0%, #13233f 52%, #2352cc 100%)',
            },
          }
        : node,
    );
    summaryParts.push('切换成了更偏科技的深色风格');
  }

  if (hasAny(prompt, ['详细', '更多字段', '丰富一点'])) {
    let changed = false;
    nodes = nodes.map((node) => {
      if (node.type !== 'form') {
        return node;
      }

      const currentFields = Array.isArray(node.props.fields) ? (node.props.fields as FormField[]) : [];
      const nextFields = buildCoreFields(prompt, true);
      if (nextFields.length <= currentFields.length) {
        return node;
      }

      changed = true;
      return {
        ...node,
        props: {
          ...node.props,
          fields: nextFields,
        },
      };
    });

    if (changed) {
      summaryParts.push('增强了表单字段信息');
    }
  }

  if (hasAny(prompt, ['报名区', '表单更显眼', '报名更显眼', '表单显眼', '突出表单', '突出报名', '报名入口更明显', '报名按钮更明显'])) {
    let highlighted = false;
    nodes = nodes.map((node) => {
      if (node.type !== 'form') {
        return node;
      }

      highlighted = true;
      return {
        ...node,
        props: {
          ...node.props,
          title:
            typeof node.props.title === 'string' && !node.props.title.includes('立即')
              ? `立即报名 · ${node.props.title}`
              : node.props.title,
          buttonText:
            typeof node.props.buttonText === 'string' ? '立即报名' : node.props.buttonText,
        },
        style: {
          ...node.style,
          border: '2px solid #2563eb',
          boxShadow: '0 18px 40px rgba(37, 99, 235, 0.18)',
          background: 'linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)',
        },
      };
    });

    if (highlighted) {
      summaryParts.push('强化了报名区的视觉重点');
    }
  }

  if (hasAny(prompt, ['报名区靠前', '表单靠前', '报名入口靠前', '把表单放前面', '把报名放前面'])) {
    const nextNodes = moveNodeAfterType(nodes, 'form', 'hero');
    if (nextNodes !== nodes) {
      nodes = nextNodes;
      summaryParts.push('把报名区调整到了更靠前的位置');
    }
  }

  if (hasAny(prompt, ['主视觉更显眼', '头图更显眼', '首屏更显眼', 'banner更显眼'])) {
    let changed = false;
    nodes = nodes.map((node) => {
      if (node.type !== 'hero') return node;
      changed = true;
      return {
        ...node,
        style: {
          ...node.style,
          padding: '48px',
          boxShadow: '0 30px 80px rgba(15, 23, 42, 0.22)',
        },
      };
    });
    if (changed) {
      summaryParts.push('增强了主视觉区块的展示力度');
    }
  }

  if (hasAny(prompt, ['青春', '活泼', '年轻', '校园'])) {
    schema.pageMeta.background = 'linear-gradient(180deg, #fff7ed 0%, #eff6ff 52%, #f0fdf4 100%)';
    nodes = nodes.map((node) =>
      node.type === 'hero'
        ? {
            ...node,
            style: {
              ...node.style,
              background: 'linear-gradient(135deg, #2563eb 0%, #ec4899 52%, #f59e0b 100%)',
            },
          }
        : node,
    );
    summaryParts.push('整体风格调整得更青春活泼');
  }

  if (hasAny(prompt, ['社团介绍', '补充介绍', '加一段介绍', '增加介绍'])) {
    const alreadyHasIntro = nodes.some(
      (node) => node.type === 'text' && typeof node.props.text === 'string' && String(node.props.text).includes('社团'),
    );
    if (!alreadyHasIntro) {
      nodes.splice(1, 0, makeText('这里可以补充社团定位、活动方向、成员氛围和迎新亮点，让新成员更快理解社团特色。'));
      summaryParts.push('补充了一段社团介绍文案');
    }
  }

  if (hasAny(prompt, ['成员介绍', '核心成员', '团队介绍'])) {
    nodes.push(
      makeFeatureList('核心成员与分工', [
        '主席团|负责整体运营和迎新组织',
        '活动组|负责活动策划与现场执行',
        '宣传组|负责海报内容与社媒传播',
      ], false),
    );
    summaryParts.push('补充了成员介绍区块');
  }

  if (hasAny(prompt, ['活动亮点', '活动丰富', '展示活动'])) {
    nodes.push(
      makeFeatureList('近期活动亮点', [
        '迎新见面会|帮助新成员快速融入',
        '主题工作坊|提升策划与执行能力',
        '校内联动活动|增强社团曝光与参与感',
      ], false),
    );
    summaryParts.push('补充了活动亮点区块');
  }

  if (hasAny(prompt, ['不要数据区', '删掉数据区', '去掉数据区'])) {
    const nextNodes = nodes.filter((node) => node.type !== 'stat-grid');
    if (nextNodes.length !== nodes.length) {
      nodes = nextNodes;
      summaryParts.push('移除了数据区块');
    }
  }

  if (hasAny(prompt, ['数据区', '加数据', '增加数据区'])) {
    const hasStats = nodes.some((node) => node.type === 'stat-grid');
    if (!hasStats) {
      nodes.push(makeStatGrid('社团数据概览', ['12个|特色活动', '300+|累计成员', '95%|活动好评']));
      summaryParts.push('补充了数据展示区块');
    }
  }

  if (hasAny(prompt, ['图片靠前', '图片放前面', '活动图靠前'])) {
    const nextNodes = moveNodeAfterType(nodes, 'image', 'hero');
    if (nextNodes !== nodes) {
      nodes = nextNodes;
      summaryParts.push('把图片区调整到了更靠前的位置');
    }
  }

  if (!summaryParts.length) {
    summaryParts.push('暂时没有识别到明确的结构修改动作');
    suggestions.push('可以继续描述你希望修改哪一块，比如主视觉、表单或 FAQ。');
  }

  schema.nodes = nodes;

  return {
    schema,
    summary: `我已经基于当前模板完成这些调整：${summaryParts.join('、')}。`,
    suggestions: suggestions.length ? suggestions : ['可以继续补充更具体的修改方向。'],
  };
}
