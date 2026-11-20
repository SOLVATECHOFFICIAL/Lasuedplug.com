import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ALL_MARKETPLACE_CATEGORIES,
  getCategoriesForAdType,
  MasterCategory,
  PRODUCT_CATEGORIES,
  SERVICE_CATEGORIES,
} from './categories';
import { AdType } from '../types';

export interface CategorySuggestion {
  categoryId: string;
  subcategory: string;
}

export interface CategorySuggestionResult {
  suggestion: CategorySuggestion | null;
  isFallback?: boolean;
}

export const MARKETPLACE_CATEGORIES: readonly MasterCategory[] =
  ALL_MARKETPLACE_CATEGORIES;

export const DEFAULT_CATEGORY_SUGGESTION: CategorySuggestion = {
  categoryId: PRODUCT_CATEGORIES[0].id,
  subcategory: PRODUCT_CATEGORIES[0].subs[0],
};

export function getDefaultCategorySuggestion(
  adType: AdType = 'item'
): CategorySuggestion {
  const list = getCategoriesForAdType(adType);
  return {
    categoryId: list[0].id,
    subcategory: list[0].subs[0],
  };
}

function getGeminiApiKey(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return String(import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  }
  return '';
}

export function parseCategorySuggestion(
  rawText: string,
  categories: readonly MasterCategory[] = PRODUCT_CATEGORIES
): CategorySuggestion | null {
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

export async function suggestCategory(
  title: string,
  description: string,
  image?: { mimeType: string; data: string },
  adType: AdType = 'item'
): Promise<CategorySuggestionResult> {
  const trimmedTitle = title.trim();
  const trimmedDesc = description.trim();
  const targetCategories =
    adType === 'service' ? SERVICE_CATEGORIES : PRODUCT_CATEGORIES;
  const fallbackSuggestion = getDefaultCategorySuggestion(adType);

  if (!trimmedTitle && !trimmedDesc && !image) {
    return { suggestion: null };
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.warn(
      'VITE_GEMINI_API_KEY is not configured. Add it in Settings > Secrets or .env.local to enable Gemini AI auto-categorization.'
    );
    return {
      suggestion: fallbackSuggestion,
      isFallback: true,
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-4-hydrogen' });

    const listingLabel = adType === 'service' ? 'service' : 'item';
    const prompt = `Read this ${listingLabel} title and description${image ? ' and inspect the attached photo' : ''}. Based on this exact list of categories: ${JSON.stringify(targetCategories)}. Return ONLY the categoryId and subcategory in this exact format: categoryId|subcategory. Do not return any other text.

Title: ${trimmedTitle || '(not provided)'}
Description: ${trimmedDesc || '(not provided)'}`;

    const result = image
      ? await model.generateContent([
          {
            inlineData: {
              mimeType: image.mimeType,
              data: image.data.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ''),
            },
          },
          prompt,
        ])
      : await model.generateContent(prompt);

    const rawText = result.response.text().trim();
    const parsed = parseCategorySuggestion(rawText, targetCategories);

    if (!parsed) {
      return {
        suggestion: fallbackSuggestion,
        isFallback: true,
      };
    }

    return {
      suggestion: parsed,
      isFallback: false,
    };
  } catch (error) {
    console.error('AI Error:', error);
    return {
      suggestion: fallbackSuggestion,
      isFallback: true,
    };
  }
}
