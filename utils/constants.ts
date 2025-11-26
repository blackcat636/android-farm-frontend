// Базовий URL API агента
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Функція для отримання динамічного URL тунелю з Cloudflare KV (через API агента)
export async function getAgentApiUrl(agentId?: string): Promise<string> {
  // Якщо є сталий URL в env і не використовується тунель, використовуємо його
  if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_USE_TUNNEL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // Спробувати отримати URL з Cloudflare KV через API агента
  if (typeof window !== 'undefined') {
    // Виконується тільки на клієнті
    try {
      const { agentApi } = await import('@/lib/api/agent');
      
      const response = await agentApi.getTunnelUrl(agentId);
      if (response.ok && response.url) {
        return response.url;
      }
    } catch (err) {
      console.warn('Не вдалося отримати URL тунелю з Cloudflare KV, використовуємо fallback');
    }
  }

  // Fallback на сталий URL
  return API_BASE_URL;
}

