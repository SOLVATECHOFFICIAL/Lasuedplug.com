import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const HOST = '0.0.0.0';
const GROQ_MODEL = 'qwen/qwen3.8-27b';
const GROQ_FALLBACK_MODEL = 'openai/gpt-oss-20b';

function getServerGroqApiKey(): string {
  const key = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '';
  return key.trim();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/groq/chat', async (req, res) => {
    const apiKey = getServerGroqApiKey();
    if (!apiKey) {
      res.status(200).json({ content: null });
      return;
    }

    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required.' });
      return;
    }

    const temperature =
      typeof req.body?.temperature === 'number' ? req.body.temperature : 0.2;
    const maxTokens =
      typeof req.body?.maxTokens === 'number' ? req.body.maxTokens : 160;

    const groq = new Groq({ apiKey });
    const modelsToTry = [GROQ_MODEL, GROQ_FALLBACK_MODEL];
    let lastError: unknown = null;

    for (const model of modelsToTry) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens:
            model === GROQ_FALLBACK_MODEL ? Math.max(maxTokens, 320) : maxTokens,
        });

        const content = completion.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim()) {
          res.json({ content: content.trim() });
          return;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (lastError) {
      console.error('Groq server error:', lastError);
    }
    res.status(200).json({ content: null });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
