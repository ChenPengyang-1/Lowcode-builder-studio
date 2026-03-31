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

const app = express();
const port = Number(process.env.AI_SERVER_PORT || 8787);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function initSse(res) {
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

app.post('/api/ai/template/generate', async (req, res, next) => {
  const { prompt, previousResponseId } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ ok: false, message: 'prompt 不能为空。' });
  }

  if (req.headers.accept?.includes('text/event-stream')) {
    initSse(res);
    try {
      writeSse(res, 'status', { text: '已连接生成服务，正在准备页面蓝图...' });
      const result = await streamGenerateTemplateWithAI({
        prompt,
        previousResponseId,
        onStatus(text) {
          writeSse(res, 'status', { text });
        },
      });
      writeSse(res, 'result', result);
      return endSse(res);
    } catch (error) {
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
  const { message, previousResponseId, currentSchema } = req.body ?? {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ ok: false, message: 'message 不能为空。' });
  }

  if (req.headers.accept?.includes('text/event-stream')) {
    initSse(res);
    try {
      writeSse(res, 'status', { text: 'AI 已连接，正在生成回复...' });
      const result = await streamChatTemplateWithAI({
        message,
        previousResponseId,
        currentSchema,
        onTextDelta(text) {
          writeSse(res, 'reply_delta', { text });
        },
      });
      writeSse(res, 'result', result);
      return endSse(res);
    } catch (error) {
      return writeSseError(res, error);
    }
  }

  try {
    const result = await chatTemplateWithAI({ message, previousResponseId, currentSchema });
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
    try {
      writeSse(res, 'status', { text: '已连接修改服务，正在理解当前页面...' });
      const result = await streamRefineTemplateWithAI({
        prompt,
        baseSchema,
        previousResponseId,
        onStatus(text) {
          writeSse(res, 'status', { text });
        },
      });
      writeSse(res, 'result', result);
      return endSse(res);
    } catch (error) {
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
