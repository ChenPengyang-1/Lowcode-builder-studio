import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import {
  generateTemplateWithAI,
  refineTemplateWithAI,
} from './services/openai-template-service.mjs';
import { chatTemplateWithAI } from './services/openai-template-chat-service.mjs';

const app = express();
const port = Number(process.env.AI_SERVER_PORT || 8787);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'lowcode-builder-studio-ai',
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    aiReady: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.post('/api/ai/template/generate', async (req, res, next) => {
  try {
    const { prompt, previousResponseId } = req.body ?? {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ ok: false, message: 'prompt 不能为空。' });
    }

    const result = await generateTemplateWithAI({ prompt, previousResponseId });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/ai/template/chat', async (req, res, next) => {
  try {
    const { message, previousResponseId, currentSchema } = req.body ?? {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ ok: false, message: 'message 不能为空。' });
    }

    const result = await chatTemplateWithAI({ message, previousResponseId, currentSchema });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

app.post('/api/ai/template/refine', async (req, res, next) => {
  try {
    const { prompt, baseSchema, previousResponseId } = req.body ?? {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ ok: false, message: 'prompt 不能为空。' });
    }
    if (!baseSchema || typeof baseSchema !== 'object') {
      return res.status(400).json({ ok: false, message: 'baseSchema 不能为空。' });
    }

    const result = await refineTemplateWithAI({ prompt, baseSchema, previousResponseId });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  const statusCode = error?.statusCode || 500;
  res.status(statusCode).json({
    ok: false,
    message: error?.message || 'AI 服务调用失败。',
  });
});

app.listen(port, () => {
  console.log(`AI server listening on http://localhost:${port}`);
});
