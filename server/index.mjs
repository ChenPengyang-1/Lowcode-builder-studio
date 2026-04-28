import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import {
  generateTemplateWithAI,
  refineTemplateWithAI,
  streamGenerateTemplateWithAI,
  streamRefineTemplateWithAI,
} from './services/openai-template-service.mjs';
import { chatTemplateWithAI, streamChatTemplateWithAI } from './services/openai-template-chat-service.mjs';
import { templateRepository } from './services/template-repository.mjs';

const app = express();
const port = Number(process.env.AI_SERVER_PORT || 8787);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function initSse(res) {
  // SSE 仍然基于 HTTP，只是把响应头切成持续推送事件流。
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function endSse(res) {
  if (res.writableEnded) return;
  res.write('event: done\n');
  res.write('data: {}\n\n');
  res.end();
}

function normalizeAiErrorMessage(error) {
  const rawMessage = error?.message || 'AI 服务调用失败。';

  if (/timeout/i.test(rawMessage)) {
    return '真实 AI 请求超时，请检查当前网络环境或代理配置。';
  }

  if (/ECONNRESET|socket hang up|fetch failed/i.test(rawMessage)) {
    return '真实 AI 连接被中断，请检查当前网络环境或代理配置。';
  }

  return rawMessage;
}

function writeSseError(res, error) {
  console.error('[AI SSE ERROR]', error);
  if (res.writableEnded) return;
  writeSse(res, 'error', {
    message: normalizeAiErrorMessage(error),
  });
  endSse(res);
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'lowcode-builder-studio-ai',
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    aiReady: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.get('/api/templates', (_req, res) => {
  res.json({
    ok: true,
    templates: templateRepository.listSummaries(),
  });
});

app.get('/api/templates/:id', (req, res) => {
  const template = templateRepository.getTemplate(req.params.id);
  if (!template) {
    return res.status(404).json({ ok: false, message: '未找到该模板。' });
  }

  return res.json({
    ok: true,
    template,
  });
});

app.post('/api/templates/bootstrap', (req, res) => {
  const { templates } = req.body ?? {};
  if (!Array.isArray(templates)) {
    return res.status(400).json({ ok: false, message: 'templates 必须是数组。' });
  }

  return res.json({
    ok: true,
    templates: templateRepository.bootstrapTemplates(templates),
  });
});

app.post('/api/templates', (req, res) => {
  const { id, name, draftSchema, publishedSchema = null, source, updatedAt, publishedAt = null, thumbnailUrl = null } = req.body ?? {};

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ ok: false, message: '模板 id 不能为空。' });
  }
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ ok: false, message: '模板名称不能为空。' });
  }
  if (!draftSchema || typeof draftSchema !== 'object') {
    return res.status(400).json({ ok: false, message: 'draftSchema 不能为空。' });
  }

  const template = templateRepository.createTemplate({
    id,
    name,
    draftSchema,
    publishedSchema,
    source,
    updatedAt: typeof updatedAt === 'string' ? updatedAt : new Date().toISOString(),
    publishedAt: typeof publishedAt === 'string' ? publishedAt : publishedAt,
    thumbnailUrl: typeof thumbnailUrl === 'string' ? thumbnailUrl : null,
  });

  return res.status(201).json({
    ok: true,
    template,
  });
});

app.put('/api/templates/:id/draft', (req, res) => {
  const { schema } = req.body ?? {};
  if (!schema || typeof schema !== 'object') {
    return res.status(400).json({ ok: false, message: 'schema 不能为空。' });
  }

  const template = templateRepository.updateDraft(req.params.id, schema);
  if (!template) {
    return res.status(404).json({ ok: false, message: '未找到要更新的模板。' });
  }

  return res.json({
    ok: true,
    template,
  });
});

app.post('/api/templates/:id/publish', (req, res) => {
  const { schema } = req.body ?? {};
  if (!schema || typeof schema !== 'object') {
    return res.status(400).json({ ok: false, message: 'schema 不能为空。' });
  }

  const template = templateRepository.publishTemplate(req.params.id, schema);
  if (!template) {
    return res.status(404).json({ ok: false, message: '未找到要发布的模板。' });
  }

  return res.json({
    ok: true,
    template,
  });
});

app.patch('/api/templates/:id/name', (req, res) => {
  const { name } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ ok: false, message: '模板名称不能为空。' });
  }

  const template = templateRepository.renameTemplate(req.params.id, name.trim());
  if (!template) {
    return res.status(404).json({ ok: false, message: '未找到要重命名的模板。' });
  }

  return res.json({
    ok: true,
    template,
  });
});

app.delete('/api/templates/:id', (req, res) => {
  const deleted = templateRepository.deleteTemplate(req.params.id);
  if (!deleted) {
    return res.status(404).json({ ok: false, message: '未找到要删除的模板。' });
  }

  return res.json({ ok: true });
});

app.post('/api/ai/template/generate', async (req, res, next) => {
  const { prompt, previousResponseId } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ ok: false, message: 'prompt 不能为空。' });
  }

  if (req.headers.accept?.includes('text/event-stream')) {
    initSse(res);
    let clientClosed = false;
    req.on('close', () => {
      clientClosed = true;
    });
    try {
      // 前端一旦 abort，这里的 close 会触发，后续就不再继续往流里写数据。
      if (clientClosed) return res.end();
      writeSse(res, 'status', { text: '已连接生成服务，正在准备页面蓝图...' });
      const result = await streamGenerateTemplateWithAI({
        prompt,
        previousResponseId,
        onStatus(text) {
          if (clientClosed || res.writableEnded) return;
          writeSse(res, 'status', { text });
        },
      });
      if (clientClosed || res.writableEnded) return res.end();
      writeSse(res, 'result', result);
      return endSse(res);
    } catch (error) {
      if (clientClosed || res.writableEnded) return res.end();
      return writeSseError(res, error);
    }
  }

  try {
    const result = await generateTemplateWithAI({ prompt, previousResponseId });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/ai/template/chat', async (req, res, next) => {
  const { message, previousResponseId, currentSchema, conversationHistory } = req.body ?? {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ ok: false, message: 'message 不能为空。' });
  }

  if (req.headers.accept?.includes('text/event-stream')) {
    initSse(res);
    let clientClosed = false;
    req.on('close', () => {
      clientClosed = true;
    });
    try {
      if (clientClosed) return res.end();
      writeSse(res, 'status', { text: 'AI 已连接，正在生成回复...' });
      // chat 链路会一边返回文本增量，一边在最后回传 intent 和 actionPrompt。
      const result = await streamChatTemplateWithAI({
        message,
        previousResponseId,
        currentSchema,
        conversationHistory,
        onTextDelta(text) {
          if (clientClosed || res.writableEnded) return;
          writeSse(res, 'reply_delta', { text });
        },
      });
      if (clientClosed || res.writableEnded) return res.end();
      writeSse(res, 'result', result);
      return endSse(res);
    } catch (error) {
      if (clientClosed || res.writableEnded) return res.end();
      return writeSseError(res, error);
    }
  }

  try {
    const result = await chatTemplateWithAI({ message, previousResponseId, currentSchema, conversationHistory });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/ai/template/refine', async (req, res, next) => {
  const { prompt, baseSchema, previousResponseId } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ ok: false, message: 'prompt 不能为空。' });
  }
  if (!baseSchema || typeof baseSchema !== 'object') {
    return res.status(400).json({ ok: false, message: 'baseSchema 不能为空。' });
  }

  if (req.headers.accept?.includes('text/event-stream')) {
    initSse(res);
    let clientClosed = false;
    req.on('close', () => {
      clientClosed = true;
    });
    try {
      if (clientClosed) return res.end();
      // refine 的状态流更偏“阶段提示”，最终完整结构还是通过 result 事件一次性返回。
      writeSse(res, 'status', { text: '已连接修改服务，正在理解当前页面...' });
      const result = await streamRefineTemplateWithAI({
        prompt,
        baseSchema,
        previousResponseId,
        onStatus(text) {
          if (clientClosed || res.writableEnded) return;
          writeSse(res, 'status', { text });
        },
      });
      if (clientClosed || res.writableEnded) return res.end();
      writeSse(res, 'result', result);
      return endSse(res);
    } catch (error) {
      if (clientClosed || res.writableEnded) return res.end();
      return writeSseError(res, error);
    }
  }

  try {
    const result = await refineTemplateWithAI({ prompt, baseSchema, previousResponseId });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error('[AI HTTP ERROR]', error);
  const statusCode = error?.statusCode || 500;
  res.status(statusCode).json({
    ok: false,
    message: normalizeAiErrorMessage(error),
  });
});

app.listen(port, () => {
  console.log(`AI server listening on http://localhost:${port}`);
});
