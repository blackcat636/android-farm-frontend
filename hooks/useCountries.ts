'use client';

import { useState, useEffect } from 'react';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { getCachedCountries, setCache } from '@/lib/cache/task-form-cache';

export interface Country {
  code: string;
  name: string;
}

export function useCountries() {
  const cached = getCachedCountries();
  const [countries, setCountries] = useState<Country[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) {
      setLoading(false);
      setCountries(cached ?? []);
      return;
    }

    const backendClient = createBackendClient(token);
    if (!cached) setLoading(true);
    backendClient
      .getCountries()
      .then((data) => {
        const list = data || [];
        setCountries(list);
        setCache({ countries: list });
      })
      .catch((err) => {
        setError(err.message || 'Failed to load countries');
        if (!cached) setCountries([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return { countries, loading, error };
}
