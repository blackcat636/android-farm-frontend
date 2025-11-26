import { useState, useEffect } from 'react';
import { agentApi } from '@/lib/api/agent';

export function useTunnelUrl(agentId?: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUrl() {
      setLoading(true);
      setError(null);

      try {
        const response = await agentApi.getTunnelUrl(agentId);
        
        if (response.ok && response.url) {
          setUrl(response.url);
        } else {
          setError(response.message || 'URL тунелю не знайдено');
        }
      } catch (err: any) {
        console.error('Помилка отримання URL тунелю:', err);
        setError(err.message || 'Не вдалося отримати URL тунелю');
      } finally {
        setLoading(false);
      }
    }

    fetchUrl();
  }, [agentId]);

  return { url, loading, error };
}

