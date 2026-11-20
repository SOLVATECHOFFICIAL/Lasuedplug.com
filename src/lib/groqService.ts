import Groq from 'groq-sdk';

export const GROQ_MODEL = 'qwen/qwen3.8-27b';
export const GROQ_FALLBACK_MODEL = 'openai/gpt-oss-20b';

export function getFrontendGroqApiKey(): string {
  try {
    const raw =
      typeof import.meta !== 'undefined' && import.meta.env
        ? import.meta.env.VITE_GROQ_API_KEY
        : '';
    return typeof raw === 'string' ? raw.trim() : '';
  } catch {
    return '';
  }
}

export function getFrontendGroqClient(): Groq | null {
  const apiKey = getFrontendGroqApiKey();
  if (!apiKey) {
    return null;
  }
  return new Groq({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

export interface GroqChatOptions {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

export async function createGroqChatCompletion(
  prompt: string,
  options?: GroqChatOptions
): Promise<string | null> {
  if (options?.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const groq = getFrontendGroqClient();
  if (!groq) {
    return null;
  }

  const modelsToTry = [GROQ_MODEL, GROQ_FALLBACK_MODEL];
  let lastError: unknown = null;

  for (const model of modelsToTry) {
    try {
      const completion = await groq.chat.completions.create(
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: options?.temperature ?? 0.2,
          max_tokens:
            model === GROQ_FALLBACK_MODEL
              ? Math.max(options?.maxTokens ?? 160, 320)
              : options?.maxTokens ?? 160,
        },
        options?.signal ? { signal: options.signal } : undefined
      );

      const content = completion.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        return content.trim();
      }
    } catch (error) {
      if (
        options?.signal?.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        throw new DOMException('Aborted', 'AbortError');
      }
      lastError = error;
    }
  }

  if (lastError) {
    console.error('Groq Error:', lastError);
  }
  return null;
}
