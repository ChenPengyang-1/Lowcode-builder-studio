function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function backgroundFromTone(tone) {
  switch (tone) {
    case 'blue':
      return 'linear-gradient(180deg, #eef6ff 0%, #f8fbff 100%)';
    case 'dark':
      return 'linear-gradient(180deg, #0b1220 0%, #111c34 100%)';
    case 'enterprise':
      return 'linear-gradient(180deg, #f4f7fb 0%, #ecf2f8 100%)';
    default:
      return 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)';
  }
}

function heroBackgroundFromTone(tone) {
  switch (tone) {
    case 'dark':
      return 'linear-gradient(135deg, #08101f 0%, #13233f 52%, #2352cc 100%)';
    case 'light':
      return 'linear-gradient(135deg, #2563eb 0%, #7dd3fc 100%)';
    case 'enterprise':
      return 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #3b82f6 100%)';
    default:
      return 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)';
  }
}

function imageUrlFromTheme(theme, aspect) {
  const width = aspect === 'banner' ? 1400 : aspect === 'square' ? 900 : 1200;

  switch (theme) {
    case 'course':
      return `https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=${width}&q=80`;
    case 'product':
      return `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=${width}&q=80`;
    case 'recruit':
      return `https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=${width}&q=80`;
    case 'business':
      return `https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=${width}&q=80`;
    default:
      return `https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=${width}&q=80`;
  }
}

function toHeroNode(section) {
  return {
    id: createId('hero'),
    type: 'hero',
    name: section.title,
    props: {
      title: section.title,
      subtitle: section.subtitle,
      note: section.note,
      ctaText: section.ctaText,
    },
    style: {
      padding: '36px',
      borderRadius: '28px',
      background: heroBackgroundFromTone(section.visualTone),
      color: '#ffffff',
      boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
      fontSize: '36px',
    },
    visible: true,
    actions: [{ type: 'none' }],
  };
}

function toFeatureListNode(section) {
  return {
    id: createId('feature'),
    type: 'feature-list',
    name: section.title,
    props: {
      title: section.title,
      items: section.items.join('|'),
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

function toStatGridNode(section) {
  return {
    id: createId('stats'),
    type: 'stat-grid',
    name: section.title,
    props: {
      title: section.title,
      items: section.items.map((item) => `${item.value}|${item.label}`).join(','),
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

function toImageNode(section) {
  const minHeight = section.aspect === 'square' ? '320px' : section.aspect === 'banner' ? '260px' : '220px';

  return {
    id: createId('image'),
    type: 'image',
    name: section.alt,
    props: {
      src: imageUrlFromTheme(section.imageTheme, section.aspect),
      alt: section.alt,
    },
    style: {
      width: '100%',
      minHeight,
      borderRadius: '22px',
      objectFit: 'cover',
    },
    visible: true,
    actions: [{ type: 'none' }],
  };
}

function toFormNode(section) {
  return {
    id: createId('form'),
    type: 'form',
    name: section.title,
    props: {
      title: section.title,
      buttonText: section.buttonText,
      fields: section.fields.map((field) => ({
        id: createId('field'),
        label: field.label,
        type: field.type,
        placeholder: field.placeholder || `请输入${field.label}`,
        required: Boolean(field.required),
        options: field.type === 'select' ? field.options ?? [] : [],
      })),
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

function toTextNode(section) {
  const fontSize = section.tone === 'title' ? '28px' : section.tone === 'note' ? '14px' : '18px';
  const fontWeight = section.tone === 'title' ? '700' : '400';
  const color = section.tone === 'note' ? '#64748b' : '#0f172a';

  return {
    id: createId('text'),
    type: 'text',
    name: section.text.slice(0, 12),
    props: {
      text: section.text,
    },
    style: {
      fontSize,
      fontWeight,
      color,
      marginBottom: '12px',
    },
    visible: true,
    actions: [{ type: 'none' }],
  };
}

function sectionToNode(section) {
  switch (section.kind) {
    case 'hero':
      return toHeroNode(section);
    case 'feature-list':
      return toFeatureListNode(section);
    case 'stat-grid':
      return toStatGridNode(section);
    case 'image':
      return toImageNode(section);
    case 'form':
      return toFormNode(section);
    case 'text':
      return toTextNode(section);
    default:
      return null;
  }
}

export function buildPageSchemaFromBlueprint(blueprint) {
  return {
    version: '3.0.0',
    pageMeta: {
      title: blueprint.pageTitle,
      description: blueprint.pageDescription,
      background: backgroundFromTone(blueprint.backgroundTone),
    },
    nodes: blueprint.sections.map(sectionToNode).filter(Boolean),
  };
}
