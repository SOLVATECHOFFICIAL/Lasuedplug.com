import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

interface MasterCategory {
  id: string;
  name: string;
  subs: readonly string[];
}

interface CatalogSummaryItem {
  id: string;
  title: string;
  category?: string;
  subcategory?: string;
  description?: string;
  location?: string;
  imageHint?: string;
}

const PRODUCT_CATEGORIES: readonly MasterCategory[] = [
  {
    id: 'electronics',
    name: 'Electronics & Gadgets',
    subs: [
      'Phones & Tablets',
      'Laptops & Computers',
      'Phone Accessories',
      'Gaming & Console Rentals',
      'Power Banks & Charging',
    ],
  },
  {
    id: 'fashion',
    name: 'Fashion & Clothing',
    subs: [
      'Shoes & Sneakers',
      'Bags & Backpacks',
      'Thrift Clothes (Okrika)',
      'Native & Corporate Wear',
      'Jewelry & Watches',
    ],
  },
  {
    id: 'books',
    name: 'Books & Academics',
    subs: ['Textbooks & Handouts', 'Past Questions', 'Stationery'],
  },
  {
    id: 'hostel',
    name: 'Hostel Essentials',
    subs: ['Bedding', 'Cooking Utensils', 'Furniture', 'Hostel Decor & Painting'],
  },
  {
    id: 'food',
    name: 'Food & Groceries',
    subs: [
      'Small Chops & Snacks (Buns, Meatpie, Bread & Egg)',
      'Cooked Meals',
      'Fast Food & Smoothies',
      'Raw Foodstuff',
      'Drinks & Beverages',
      'Water Delivery',
    ],
  },
];

const SERVICE_CATEGORIES: readonly MasterCategory[] = [
  {
    id: 'tech_repairs',
    name: 'Tech & Repairs',
    subs: [
      'Phone Repairs',
      'Phone Flashing & Unlocking',
      'Laptop Repairs',
      'Appliance Repairs',
    ],
  },
  {
    id: 'beauty',
    name: 'Beauty & Grooming',
    subs: ['Hair Styling', 'Barbing', 'Makeup & Gele', 'Nails & Pedicure'],
  },
  {
    id: 'cyber',
    name: 'Cyber & Printing',
    subs: [
      'Cyber Cafe (Typing)',
      'Photocopy & Lamination',
      'Printing & Binding',
      'Project Formatting',
    ],
  },
  {
    id: 'creative',
    name: 'Creative & Professional',
    subs: [
      'Graphic Design',
      'Web Design',
      'Photography',
      'Event Rentals',
      'Event Tickets',
    ],
  },
  {
    id: 'everyday',
    name: 'Everyday Services',
    subs: [
      'Laundry & Ironing',
      'Tailoring',
      'POS & Cash Out',
      'Delivery & Errands',
      'Bike/Keke/Car Hire',
      'VTU (Data/Airtime)',
    ],
  },
  {
    id: 'academics',
    name: 'Academic & Skills',
    subs: ['Private Tutoring', 'Project Help', 'Skill Acquisition'],
  },
];

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseCategorySuggestion(
  rawText: string,
  categories: readonly MasterCategory[]
): { categoryId: string; subcategory: string } | null {
  if (!rawText) return null;

  const firstLine = rawText
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim()
    .split(/\r?\n/)[0]
    .trim();

  const parts = firstLine.split('|');
  if (parts.length < 2) return null;

  const rawCategory = parts[0].trim().toLowerCase();
  const rawSubcategory = parts.slice(1).join('|').trim();

  const matchedCategory =
    categories.find((cat) => cat.id.toLowerCase() === rawCategory) ||
    categories.find((cat) => cat.name.toLowerCase() === rawCategory);

  if (!matchedCategory) return null;

  const matchedSubcategory =
    matchedCategory.subs.find(
      (sub) => sub.toLowerCase() === rawSubcategory.toLowerCase()
    ) ||
    matchedCategory.subs.find(
      (sub) =>
        sub.toLowerCase().includes(rawSubcategory.toLowerCase()) ||
        rawSubcategory.toLowerCase().includes(sub.toLowerCase())
    ) ||
    matchedCategory.subs[0];

  return {
    categoryId: matchedCategory.id,
    subcategory: matchedSubcategory,
  };
}

function parseExpandedKeywords(rawText: string): string[] {
  if (!rawText) return [];
  const cleaned = rawText
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .replace(/^\s*[-*\d.)]+\s*/gm, '');

  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const part of cleaned.split(/[,\n]+/)) {
    const trimmed = part.trim().replace(/^["'`]+|["'`]+$/g, '');
    const normalized = trimmed.toLowerCase();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      keywords.push(trimmed);
    }
    if (keywords.length >= 8) {
      break;
    }
  }

  return keywords;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.post('/api/ai/suggest-category', async (req: Request, res: Response) => {
    try {
      const { title = '', description = '', image, adType = 'item' } = (req.body || {}) as {
        title?: string;
        description?: string;
        image?: { mimeType?: string; data?: string };
        adType?: 'item' | 'service';
      };

      const trimmedTitle = String(title).trim();
      const trimmedDesc = String(description).trim();
      const targetCategories =
        adType === 'service' ? SERVICE_CATEGORIES : PRODUCT_CATEGORIES;

      if (!trimmedTitle && !trimmedDesc && !image?.data) {
        res.json({ suggestion: null, isFallback: false });
        return;
      }

      const ai = getGenAIClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured on the server.',
        });
        return;
      }

      const listingLabel = adType === 'service' ? 'service' : 'item';
      const hasImage = Boolean(image?.data && image?.mimeType);
      const prompt = `Read this ${listingLabel} title and description${hasImage ? ' and inspect the attached photo' : ''}. Based on this exact list of categories: ${JSON.stringify(targetCategories)}. Return ONLY the categoryId and subcategory in this exact format: categoryId|subcategory. Do not return any other text.

Title: ${trimmedTitle || '(not provided)'}
Description: ${trimmedDesc || '(not provided)'}`;

      const contents = hasImage
        ? {
            parts: [
              {
                inlineData: {
                  mimeType: String(image!.mimeType),
                  data: String(image!.data).replace(
                    /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
                    ''
                  ),
                },
              },
              { text: prompt },
            ],
          }
        : prompt;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
      });

      const rawText = (response.text ?? '').trim();
      const parsed = parseCategorySuggestion(rawText, targetCategories);

      if (!parsed) {
        res.json({ suggestion: null, isFallback: true });
        return;
      }

      res.json({ suggestion: parsed, isFallback: false });
    } catch (error) {
      console.error('AI category suggestion error:', error);
      res.status(502).json({
        error: 'Failed to generate category suggestion.',
      });
    }
  });

  app.post('/api/ai/expand-search', async (req: Request, res: Response) => {
    try {
      const { query = '', catalog = [] } = (req.body || {}) as {
        query?: string;
        catalog?: CatalogSummaryItem[];
      };

      const trimmed = String(query).trim().slice(0, 600);
      if (!trimmed) {
        res.json({ keywords: [] });
        return;
      }

      const ai = getGenAIClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured on the server.',
        });
        return;
      }

      const filteredCatalog = Array.isArray(catalog)
        ? catalog
            .filter((c) => c.category?.toLowerCase() !== 'accommodation')
            .slice(0, 200)
        : [];
      const validCatalogIds = new Set(filteredCatalog.map((c) => c.id));

      if (filteredCatalog.length > 0) {
        const compactCatalog = filteredCatalog.map((c) => ({
          id: c.id,
          t: c.title,
          c: [c.category, c.subcategory].filter(Boolean).join(' / '),
          d: c.description,
          l: c.location,
          img: c.imageHint,
        }));

        const prompt = `Smart campus marketplace search for LASUEDPLUG (products & services only, never houses/accommodation).
Query: "${trimmed}"
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
          config: { responseMimeType: 'application/json' },
        });

        const rawJson = (response.text ?? '')
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

        res.json({
          keywords,
          matchedIds,
          relatedIds,
          correctedQuery,
          answer,
        });
        return;
      }

      const prompt = `The user is searching a campus marketplace for: '${trimmed}'. Handle any typos, misspellings, slang, or long phrases. Return a comma-separated list of 5 specific related items they might be looking for. Example: If they search 'eat bread', return 'butter, akara, egg, tea, jam'. If they search 'phone', return 'iphone, android, charger, case, screen protector'. Return ONLY the comma-separated list, no other text.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
      });

      res.json({
        keywords: parseExpandedKeywords((response.text ?? '').trim()),
      });
    } catch (error) {
      console.error('AI search expansion error:', error);
      res.status(502).json({
        error: 'Failed to expand search query.',
      });
    }
  });

  app.post('/api/ai/search-by-image', async (req: Request, res: Response) => {
    try {
      const { image, catalog = [], query = '' } = (req.body || {}) as {
        image?: { mimeType?: string; data?: string };
        catalog?: CatalogSummaryItem[];
        query?: string;
      };

      if (!image?.data || !image?.mimeType) {
        res.status(400).json({ error: 'Image payload is required.' });
        return;
      }

      const ai = getGenAIClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured on the server.',
        });
        return;
      }

      const filteredCatalog = Array.isArray(catalog)
        ? catalog
            .filter((c) => c.category?.toLowerCase() !== 'accommodation')
            .slice(0, 200)
        : [];
      const validCatalogIds = new Set(filteredCatalog.map((c) => c.id));

      const compactCatalog = filteredCatalog.map((c) => ({
        id: c.id,
        t: c.title,
        c: [c.category, c.subcategory].filter(Boolean).join(' / '),
        d: c.description,
        l: c.location,
      }));

      const userNote = String(query).trim().slice(0, 300);
      const prompt = `Visual campus marketplace search for LASUEDPLUG.
Analyze the uploaded photo carefully${userNote ? ` along with the user note "${userNote}"` : ''}.
Identify what product/item is shown in the picture (type, brand, purpose, synonyms) and match it against these active marketplace listings:
${JSON.stringify(compactCatalog)}

Rules:
- "detectedItem": short 2-5 word name of what you see in the picture (e.g. "White Nike sneakers", "Electric kettle", "HP laptop").
- "keywords": 5-8 relevant search terms describing the object in the image.
- "matchedIds": listing IDs that best match what is in the picture.
- "relatedIds": backup similar listing IDs if direct matches are few.
- "answer": 1 friendly sentence explaining what was detected in the photo and what matching campus listings were found.
Return ONLY valid JSON:
{"detectedItem":"...","keywords":["..."],"matchedIds":["..."],"relatedIds":["..."],"answer":"..."}`;

      const cleanData = String(image.data).replace(
        /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
        ''
      );

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: String(image.mimeType),
                data: cleanData,
              },
            },
            { text: prompt },
          ],
        },
        config: { responseMimeType: 'application/json' },
      });

      const rawJson = (response.text ?? '')
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

      const detectedItem =
        typeof parsed.detectedItem === 'string' && parsed.detectedItem.trim()
          ? parsed.detectedItem.trim()
          : undefined;

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

      const answer =
        typeof parsed.answer === 'string' && parsed.answer.trim()
          ? parsed.answer.trim()
          : undefined;

      res.json({
        detectedItem,
        keywords,
        matchedIds,
        relatedIds,
        correctedQuery:
          typeof parsed.correctedQuery === 'string' && parsed.correctedQuery.trim()
            ? parsed.correctedQuery.trim()
            : detectedItem,
        answer,
      });
    } catch (error) {
      console.error('AI visual search error:', error);
      res.status(502).json({
        error: 'Failed to process visual search.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path.join(distDir, 'index.html'));
        return;
      }
      next();
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LASUEDPLUG server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
