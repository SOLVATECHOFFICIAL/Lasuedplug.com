import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config({ path: '.env.local', override: true });
dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

interface CatalogSearchInput {
  id: string;
  title: string;
  category?: string;
  subcategory?: string;
  description?: string;
  location?: string;
  imageHint?: string;
}

function parseKeywordsFromGeminiText(rawText: string): string[] {
  if (!rawText) return [];
  const cleaned = rawText
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .replace(/^\s*[-*\d.)]+\s*/gm, '');

  const seen = new Set<string>();
  const results: string[] = [];

  for (const part of cleaned.split(/[,\n]+/)) {
    const item = part.trim().replace(/^["'`]+|["'`]+$/g, '');
    const normalized = item.toLowerCase();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      results.push(item);
    }
    if (results.length >= 8) {
      break;
    }
  }

  return results;
}

function sanitizeCatalogInput(rawCatalog: unknown): CatalogSearchInput[] {
  if (!Array.isArray(rawCatalog)) return [];
  const items: CatalogSearchInput[] = [];
  for (const entry of rawCatalog.slice(0, 200)) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id.trim() : '';
    const title = typeof rec.title === 'string' ? rec.title.trim() : '';
    if (!id || !title) continue;
    items.push({
      id,
      title: title.slice(0, 120),
      category:
        typeof rec.category === 'string' ? rec.category.trim().slice(0, 80) : undefined,
      subcategory:
        typeof rec.subcategory === 'string'
          ? rec.subcategory.trim().slice(0, 80)
          : undefined,
      description:
        typeof rec.description === 'string'
          ? rec.description.trim().slice(0, 180)
          : undefined,
      location:
        typeof rec.location === 'string' ? rec.location.trim().slice(0, 80) : undefined,
      imageHint:
        typeof rec.imageHint === 'string'
          ? rec.imageHint.trim().slice(0, 100)
          : undefined,
    });
  }
  return items;
}

function formatGeminiServerError(err: unknown): {
  status: number;
  message: string;
} {
  const rawMessage = err instanceof Error ? err.message : String(err || '');
  let extracted = rawMessage;

  try {
    const parsed = JSON.parse(rawMessage);
    if (typeof parsed?.error?.message === 'string') {
      extracted = parsed.error.message;
    } else if (typeof parsed?.message === 'string') {
      extracted = parsed.message;
    }
  } catch {
    // Not a JSON string; inspect rawMessage directly
  }

  if (
    /API_KEY_INVALID|API key not valid|invalid api key|PERMISSION_DENIED/i.test(
      rawMessage + ' ' + extracted
    )
  ) {
    return {
      status: 503,
      message:
        'AI search expansion requires a valid Gemini API key in .env.local or Settings > Secrets. Showing direct keyword matches instead.',
    };
  }

  if (/429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(rawMessage + ' ' + extracted)) {
    return {
      status: 429,
      message:
        'AI search is temporarily busy. Showing direct keyword matches instead.',
    };
  }

  return {
    status: 502,
    message:
      'AI search expansion is temporarily unavailable. Showing direct keyword matches instead.',
  };
}

function isConfiguredApiKey(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(your_|placeholder|changeme|test|demo|none|null|undefined)/i.test(trimmed)) {
    return false;
  }
  return trimmed.length >= 20;
}

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const searchCache = new Map<
  string,
  { expiresAt: number; payload: Record<string, unknown> }
>();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/ai/expand-search', async (req: Request, res: Response) => {
    const rawQuery = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!rawQuery) {
      res.status(400).json({ error: 'Search query is required.' });
      return;
    }

    const sanitizedQuery = rawQuery.slice(0, 600);
    const catalog = sanitizeCatalogInput(req.body?.catalog);
    const validCatalogIds = new Set(catalog.map((item) => item.id));
    const cacheKey = `${sanitizedQuery.toLowerCase()}::${catalog.map((c) => c.id).join(',')}`;
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.payload);
      return;
    }

    const apiKey = (
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      ''
    ).trim();

    if (!isConfiguredApiKey(apiKey)) {
      res.status(503).json({
        error:
          'AI search expansion requires a valid Gemini API key in .env.local or Settings > Secrets. Showing direct keyword matches instead.',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      if (catalog.length > 0) {
        const compactCatalog = catalog.map((c) => ({
          id: c.id,
          t: c.title,
          c: [c.category, c.subcategory].filter(Boolean).join(' / '),
          d: c.description,
          l: c.location,
          img: c.imageHint,
        }));
        const prompt = `Smart campus marketplace search for LASUEDPLUG.
Query: "${sanitizedQuery}"
Listings (id, t=title, c=category, d=description, l=location, img=image words):
${JSON.stringify(compactCatalog)}

Rules:
- Fix typos/misspellings, slang, compound words, and long questions.
- Scan every listing. Put best matching IDs in "matchedIds", and backup related IDs in "relatedIds" so results are NEVER empty.
- Include "correctedQuery", 5-8 "keywords", and a 1-sentence "answer" for the user.
Return ONLY valid JSON:
{"correctedQuery":"...","keywords":["..."],"matchedIds":["..."],"relatedIds":["..."],"answer":"..."}`;

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
          },
        });

        const rawJson = (response.text ?? '{}')
          .trim()
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/```$/i, '')
          .trim();
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(rawJson) as Record<string, unknown>;
        } catch {
          parsed = {};
        }

        const keywords = Array.isArray(parsed.keywords)
          ? parsed.keywords
              .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
              .slice(0, 8)
          : [];

        const matchedIds = Array.isArray(parsed.matchedIds)
          ? Array.from(
              new Set(
                parsed.matchedIds.filter(
                  (id): id is string => typeof id === 'string' && validCatalogIds.has(id)
                )
              )
            )
          : [];

        const relatedIds = Array.isArray(parsed.relatedIds)
          ? Array.from(
              new Set(
                parsed.relatedIds.filter(
                  (id): id is string =>
                    typeof id === 'string' &&
                    validCatalogIds.has(id) &&
                    !matchedIds.includes(id)
                )
              )
            )
          : [];

        const correctedQuery =
          typeof parsed.correctedQuery === 'string' && parsed.correctedQuery.trim()
            ? parsed.correctedQuery.trim()
            : undefined;

        const answer =
          typeof parsed.answer === 'string' && parsed.answer.trim()
            ? parsed.answer.trim()
            : undefined;

        const payload = {
          keywords,
          matchedIds,
          relatedIds,
          correctedQuery,
          answer,
        };
        searchCache.set(cacheKey, {
          expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
          payload,
        });
        res.json(payload);
        return;
      }

      const prompt = `The user is searching a campus marketplace for: '${sanitizedQuery}'. Handle any typos, misspellings, slang, or long phrases. Return a comma-separated list of 5 specific related items they might be looking for. Example: If they search 'eat bread', return 'butter, akara, egg, tea, jam'. If they search 'phone', return 'iphone, android, charger, case, screen protector'. Return ONLY the comma-separated list, no other text.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const rawText = (response.text ?? '').trim();
      const keywords = parseKeywordsFromGeminiText(rawText);

      res.json({
        keywords,
        rawText,
      });
    } catch (err) {
      const formatted = formatGeminiServerError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve('dist');
    app.use(express.static(distDir));
    app.get('{*path}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`LASUEDPLUG server listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
