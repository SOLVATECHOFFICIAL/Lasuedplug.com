import { Product } from '../types';
import { getCategoryName } from './categories';
import { getTimestampMillis } from './homeHelpers';

export interface CatalogSummaryItem {
  id: string;
  title: string;
  category?: string;
  subcategory?: string;
  description?: string;
  location?: string;
  imageHint?: string;
}

export interface ExpandSearchResult {
  keywords: string[];
  matchedIds?: string[];
  relatedIds?: string[];
  correctedQuery?: string;
  answer?: string;
}

export interface VisualSearchResult extends ExpandSearchResult {
  detectedItem?: string;
}

export interface SmartSearchMatchResult {
  products: Product[];
  directMatchCount: number;
  usedRelatedFallback: boolean;
}

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'your',
  'have',
  'need',
  'want',
  'looking',
  'look',
  'find',
  'best',
  'good',
  'where',
  'what',
  'when',
  'how',
  'can',
  'you',
  'please',
  'help',
  'buy',
  'get',
  'sell',
  'item',
  'items',
  'something',
  'anything',
  'around',
  'campus',
  'lasued',
  'lasu',
  'epe',
  'here',
  'near',
  'there',
  'are',
  'any',
  'all',
]);

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const clientSearchCache = new Map<
  string,
  { expiresAt: number; payload: ExpandSearchResult }
>();

export function extractImageHint(images: string[] | undefined): string {
  if (!Array.isArray(images) || images.length === 0) return '';
  const words = new Set<string>();
  for (const url of images) {
    if (typeof url !== 'string' || !url.trim() || url.startsWith('data:')) continue;
    const cleanPath = url.split('?')[0].split('#')[0];
    const fileName = cleanPath.split('/').pop() || '';
    const baseName = fileName.replace(/\.[a-z0-9]{2,5}$/i, '');
    for (const part of baseName.split(/[-_\s]+/)) {
      const normalized = part.toLowerCase().trim();
      if (
        normalized.length >= 3 &&
        !/^[0-9]+$/.test(normalized) &&
        !/^[a-f0-9]{8,}$/i.test(normalized)
      ) {
        words.add(normalized);
      }
    }
  }
  return Array.from(words).slice(0, 8).join(' ');
}

export function buildCatalogSummaryForAi(products: Product[]): CatalogSummaryItem[] {
  return products
    .filter(
      (p) =>
        p.isApproved === true &&
        p.isActive === true &&
        p.categoryId !== 'accommodation' &&
        Boolean(p.id)
    )
    .slice(0, 200)
    .map((p) => ({
      id: p.id as string,
      title: p.title,
      category: getCategoryName(p.categoryId) || p.categoryName,
      subcategory: p.subcategory,
      description: p.description?.slice(0, 180),
      location:
        p.serviceLocation === 'online' || p.locationType === 'online'
          ? 'Online / Delivery'
          : p.serviceLocation === 'mobile'
            ? 'We come to you'
            : p.locationName || p.landmark || p.location || p.storeName || p.shopName,
      imageHint: extractImageHint(p.images),
    }));
}

export function parseExpandedKeywords(rawText: string): string[] {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenizeWords(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 3) return Math.abs(m - n);

  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;

  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= n; j += 1) prev[j] = curr[j];
  }

  return prev[n];
}

function matchesTermOrFuzzy(text: string, term: string): 'exact' | 'fuzzy' | null {
  if (!text || !term) return null;
  const normalizedText = text.toLowerCase();
  const normalizedTerm = term.toLowerCase().trim();
  if (!normalizedTerm) return null;

  if (normalizedTerm.includes(' ')) {
    return normalizedText.includes(normalizedTerm) ? 'exact' : null;
  }

  const boundaryRegex = new RegExp(`\\b${escapeRegExp(normalizedTerm)}`, 'i');
  if (boundaryRegex.test(normalizedText)) {
    return 'exact';
  }

  const words = tokenizeWords(normalizedText);

  if (normalizedTerm.length >= 8) {
    const matchedSubwords = words.filter(
      (w) => w.length >= 4 && normalizedTerm.includes(w)
    );
    if (matchedSubwords.length > 0) {
      return 'exact';
    }
  }

  if (normalizedTerm.length >= 4) {
    const maxAllowedEdits = normalizedTerm.length >= 6 ? 2 : 1;
    for (const word of words) {
      if (word.length < 4) continue;
      if (word.length >= 6 && normalizedTerm.length >= 4 && word.includes(normalizedTerm)) {
        return 'fuzzy';
      }
      if (Math.abs(word.length - normalizedTerm.length) <= maxAllowedEdits) {
        const dist = editDistance(word, normalizedTerm);
        if (dist <= maxAllowedEdits) {
          return 'fuzzy';
        }
      }
    }
  }

  return null;
}

export function matchProductsBySearchKeywords(
  products: Product[],
  originalQuery: string,
  expandedKeywords: string[],
  aiHints?: {
    matchedIds?: string[];
    relatedIds?: string[];
    correctedQuery?: string;
  }
): Product[] {
  const normalizedQuery = originalQuery.trim().toLowerCase();
  const correctedQuery = aiHints?.correctedQuery?.trim().toLowerCase() || '';
  const normalizedKeywords = expandedKeywords
    .map((kw) => kw.trim().toLowerCase())
    .filter(Boolean);

  const matchedIdRank = new Map<string, number>();
  (aiHints?.matchedIds || []).forEach((id, idx) => {
    matchedIdRank.set(id, idx);
  });

  if (
    !normalizedQuery &&
    !correctedQuery &&
    normalizedKeywords.length === 0 &&
    matchedIdRank.size === 0
  ) {
    return products;
  }

  const scored: { product: Product; score: number }[] = [];

  for (const product of products) {
    if (
      product.isApproved !== true ||
      product.isActive !== true ||
      product.categoryId === 'accommodation'
    ) {
      continue;
    }

    const title = (product.title || '').toLowerCase();
    const subcategory = (product.subcategory || '').toLowerCase();
    const categoryName = (
      getCategoryName(product.categoryId) ||
      product.categoryName ||
      product.categoryId ||
      ''
    ).toLowerCase();
    const description = (product.description || '').toLowerCase();
    const location = (
      product.locationName ||
      product.landmark ||
      product.location ||
      product.storeName ||
      product.shopName ||
      ''
    ).toLowerCase();
    const imageHint = extractImageHint(product.images);

    let score = 0;

    if (product.id && matchedIdRank.has(product.id)) {
      const rank = matchedIdRank.get(product.id) ?? 99;
      score += Math.max(12, 30 - rank);
    }

    const queriesToCheck = Array.from(
      new Set([normalizedQuery, correctedQuery].filter(Boolean))
    );

    for (const q of queriesToCheck) {
      if (title.includes(q)) score += 12;
      else if (subcategory.includes(q) || categoryName.includes(q)) score += 6;
      else if (description.includes(q) || location.includes(q) || imageHint.includes(q)) {
        score += 4;
      }

      const tokens = tokenizeWords(q).filter(
        (t) => t.length >= 3 && !STOPWORDS.has(t)
      );
      for (const token of tokens) {
        const titleHit = matchesTermOrFuzzy(title, token);
        if (titleHit === 'exact') score += 5;
        else if (titleHit === 'fuzzy') score += 3;

        const subHit =
          matchesTermOrFuzzy(subcategory, token) ||
          matchesTermOrFuzzy(categoryName, token);
        if (subHit === 'exact') score += 2.5;
        else if (subHit === 'fuzzy') score += 1.5;

        const bodyHit =
          matchesTermOrFuzzy(description, token) ||
          matchesTermOrFuzzy(location, token) ||
          matchesTermOrFuzzy(imageHint, token);
        if (bodyHit === 'exact') score += 1.5;
        else if (bodyHit === 'fuzzy') score += 1;
      }
    }

    for (const kw of normalizedKeywords) {
      const titleHit = matchesTermOrFuzzy(title, kw);
      if (titleHit === 'exact') score += 6;
      else if (titleHit === 'fuzzy') score += 3.5;
      else if (
        matchesTermOrFuzzy(subcategory, kw) ||
        matchesTermOrFuzzy(categoryName, kw)
      ) {
        score += 3;
      } else if (
        matchesTermOrFuzzy(description, kw) ||
        matchesTermOrFuzzy(location, kw) ||
        matchesTermOrFuzzy(imageHint, kw)
      ) {
        score += 2;
      }
    }

    if (score > 0) {
      scored.push({ product, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const contactDiff = (b.product.contactCount || 0) - (a.product.contactCount || 0);
    if (contactDiff !== 0) return contactDiff;
    return getTimestampMillis(b.product.createdAt) - getTimestampMillis(a.product.createdAt);
  });

  return scored.map((entry) => entry.product);
}

export function findBestAndRelatedProducts(
  products: Product[],
  originalQuery: string,
  aiResult?: ExpandSearchResult
): SmartSearchMatchResult {
  const activeApproved = products.filter(
    (p) =>
      p.isApproved === true &&
      p.isActive === true &&
      p.categoryId !== 'accommodation'
  );

  const directMatches = matchProductsBySearchKeywords(
    activeApproved,
    originalQuery,
    aiResult?.keywords || [],
    {
      matchedIds: aiResult?.matchedIds,
      relatedIds: aiResult?.relatedIds,
      correctedQuery: aiResult?.correctedQuery,
    }
  );

  if (directMatches.length > 0) {
    if (directMatches.length < 2 && aiResult?.relatedIds?.length) {
      const seen = new Set(directMatches.map((item) => item.id));
      const extras = aiResult.relatedIds
        .map((id) => activeApproved.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p && p.id && !seen.has(p.id)))
        .slice(0, 4);

      return {
        products: [...directMatches, ...extras],
        directMatchCount: directMatches.length,
        usedRelatedFallback: false,
      };
    }

    return {
      products: directMatches,
      directMatchCount: directMatches.length,
      usedRelatedFallback: false,
    };
  }

  if (activeApproved.length === 0) {
    return {
      products: [],
      directMatchCount: 0,
      usedRelatedFallback: false,
    };
  }

  const fallbackList: Product[] = [];
  const seen = new Set<string>();

  for (const id of aiResult?.relatedIds || []) {
    const match = activeApproved.find((p) => p.id === id);
    if (match && match.id && !seen.has(match.id)) {
      seen.add(match.id);
      fallbackList.push(match);
    }
  }

  const remaining = [...activeApproved].sort((a, b) => {
    const contactDiff = (b.contactCount || 0) - (a.contactCount || 0);
    if (contactDiff !== 0) return contactDiff;
    const viewDiff = (b.viewCount || 0) - (a.viewCount || 0);
    if (viewDiff !== 0) return viewDiff;
    return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
  });

  for (const item of remaining) {
    if (fallbackList.length >= 8) break;
    if (item.id && !seen.has(item.id)) {
      seen.add(item.id);
      fallbackList.push(item);
    }
  }

  return {
    products: fallbackList,
    directMatchCount: 0,
    usedRelatedFallback: true,
  };
}

export async function expandSearchQuery(
  query: string,
  catalog: CatalogSummaryItem[] = [],
  signal?: AbortSignal
): Promise<ExpandSearchResult> {
  const trimmed = query.trim().slice(0, 600);
  if (!trimmed) {
    return { keywords: [] };
  }

  const filteredCatalog = catalog
    .filter((c) => c.category?.toLowerCase() !== 'accommodation')
    .slice(0, 200);
  const cacheKey = `${trimmed.toLowerCase()}::${filteredCatalog.map((c) => c.id).join(',')}`;
  const cached = clientSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  try {
    const response = await fetch('/api/ai/expand-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: trimmed,
        catalog: filteredCatalog,
      }),
      signal,
    });

    if (!response.ok) {
      return { keywords: [] };
    }

    const payload = (await response.json()) as ExpandSearchResult;
    clientSearchCache.set(cacheKey, {
      expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
      payload,
    });
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    console.error('AI Search Error:', error);
    return { keywords: [] };
  }
}

export async function searchByImage(
  image: { mimeType: string; data: string },
  catalog: CatalogSummaryItem[] = [],
  query = '',
  signal?: AbortSignal
): Promise<VisualSearchResult> {
  const filteredCatalog = catalog
    .filter((c) => c.category?.toLowerCase() !== 'accommodation')
    .slice(0, 200);

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  try {
    const response = await fetch('/api/ai/search-by-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image,
        catalog: filteredCatalog,
        query,
      }),
      signal,
    });

    if (!response.ok) {
      return { keywords: [] };
    }

    return (await response.json()) as VisualSearchResult;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    console.error('AI Visual Search Error:', error);
    return { keywords: [] };
  }
}
