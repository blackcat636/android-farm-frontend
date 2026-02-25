'use client';

import { useState, useEffect } from 'react';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';

export interface Country {
  code: string;
  name: string;
}

export function useCountries() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) {
      setLoading(false);
      setCountries([]);
      return;
    }

    const backendClient = createBackendClient(token);
    backendClient
      .getCountries()
      .then((data) => setCountries(data || []))
      .catch((err) => {
        setError(err.message || 'Failed to load countries');
        setCountries([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return { countries, loading, error };
}
