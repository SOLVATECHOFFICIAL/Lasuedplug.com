import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Groq from 'groq-sdk';

const GROQ_MODEL = 'qwen/qwen3.8-27b';
const GROQ_FALLBACK_MODEL = 'openai/gpt-oss-20b';
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.post('/api/groq', async (req, res) => {
    const body = req.body as {
      prompt?: unknown;
      temperature?: unknown;
      maxTokens?: unknown;
    } | null;

    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt || prompt.length > 16_000) {
      res.status(400).json({ content: null, error: 'Invalid prompt' });
      return;
    }

    const apiKey =
      process.env.GROQ_API_KEY?.trim() ||
      process.env.VITE_GROQ_API_KEY?.trim() ||
      '';

    if (!apiKey) {
      res.json({ content: null });
      return;
    }

    const temperature =
      typeof body?.temperature === 'number' && Number.isFinite(body.temperature)
        ? Math.min(Math.max(body.temperature, 0), 2)
        : 0.2;
    const maxTokens =
      typeof body?.maxTokens === 'number' && Number.isFinite(body.maxTokens)
        ? Math.min(Math.max(Math.round(body.maxTokens), 1), 1024)
        : 160;

    const client = new Groq({ apiKey });
    const models = [GROQ_MODEL, GROQ_FALLBACK_MODEL];

    for (const model of models) {
      try {
        const completion = await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
        });

        const content = completion.choices?.[0]?.message?.content?.trim() || null;
        if (content) {
          res.json({ content });
          return;
        }
      } catch (err) {
        if (model === GROQ_FALLBACK_MODEL) {
          console.error('Groq API error:', err);
        }
      }
    }

    res.json({ content: null });
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn('Vite dev middleware unavailable, serving dist/:', err);
      mountStaticDist(app);
    }
  } else {
    mountStaticDist(app);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
}

function mountStaticDist(app: express.Express) {
  const distDir = path.resolve(__dirname, 'dist');
  const indexPath = path.join(distDir, 'index.html');

  if (fs.existsSync(distDir)) {
    app.get('/sitemap.xml', (_req, res, next) => {
      const sitemapPath = path.join(distDir, 'sitemap.xml');
      if (fs.existsSync(sitemapPath)) {
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        res.sendFile(sitemapPath);
        return;
      }
      next();
    });

    app.get('/robots.txt', (_req, res, next) => {
      const robotsPath = path.join(distDir, 'robots.txt');
      if (fs.existsSync(robotsPath)) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        res.sendFile(robotsPath);
        return;
      }
      next();
    });

    app.use(express.static(distDir));
  }

  app.get('/{*splat}', (_req, res) => {
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Not found');
    }
  });
}

void startServer();
