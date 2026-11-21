import Groq from 'groq-sdk';

export const GROQ_MODEL = 'qwen/qwen3.8-27b';
export const GROQ_FALLBACK_MODEL = 'openai/gpt-oss-20b';

export function getFrontendGroqApiKey(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_GROQ_API_KEY?.trim() || '';
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

  const client = getFrontendGroqClient();
  if (!client) {
    return null;
  }

  const models = [GROQ_MODEL, GROQ_FALLBACK_MODEL];

  for (const model of models) {
    try {
      const completion = await client.chat.completions.create(
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 160,
        },
        options?.signal ? { signal: options.signal } : undefined
      );

      const content = completion.choices?.[0]?.message?.content?.trim();
      if (content) {
        return content;
      }
    } catch (error) {
      if (
        options?.signal?.aborted ||
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        throw new DOMException('Aborted', 'AbortError');
      }
      if (model === GROQ_FALLBACK_MODEL) {
        console.error('Groq Error:', error);
      }
    }
  }

  return null;
}
