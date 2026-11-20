export const GROQ_MODEL = 'qwen/qwen3.8-27b';
export const GROQ_FALLBACK_MODEL = 'openai/gpt-oss-20b';

export function getFrontendGroqApiKey(): string {
  return '';
}

export function getFrontendGroqClient(): null {
  return null;
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

  if (typeof fetch !== 'function') {
    return null;
  }

  try {
    const response = await fetch('/api/groq/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        temperature: options?.temperature ?? 0.2,
        maxTokens: options?.maxTokens ?? 160,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { content?: unknown };
    if (typeof data?.content === 'string' && data.content.trim()) {
      return data.content.trim();
    }
    return null;
  } catch (error) {
    if (
      options?.signal?.aborted ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      throw new DOMException('Aborted', 'AbortError');
    }
    console.error('Groq Error:', error);
    return null;
  }
}
