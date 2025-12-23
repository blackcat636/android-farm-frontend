'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, tokenStorage, setOnTokenRefreshed } from '@/lib/api/backend';
import { message } from 'antd';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async (skipLoading = false) => {
    const token = tokenStorage.get();
    if (!token) {
      setUser(null);
      if (!skipLoading) {
        setLoading(false);
      }
      return;
    }

    if (!skipLoading) {
      setLoading(true);
    }

    try {
      const userData = await authApi.getMe(token);
      setUser(userData);
      console.log('[AuthContext] ✅ Дані користувача оновлено');
    } catch (error: any) {
      console.error('[AuthContext] Помилка оновлення користувача:', error?.response?.data || error?.message);
      // Якщо це 401 помилка, токен буде оновлено через interceptor автоматично
      // Не видаляємо токен тут, оскільки interceptor спробує оновити його
      if (error?.response?.status === 401) {
        console.log('[AuthContext] Отримано 401, очікую на оновлення токену через interceptor...');
        // Не встановлюємо loading = false, оскільки interceptor може оновити токен
        return;
      }
      tokenStorage.remove();
      setUser(null);
    } finally {
      if (!skipLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Підписуємося на оновлення токену
  useEffect(() => {
    // Callback для оповіщення про успішний refresh
    const handleTokenRefreshed = (token: string) => {
      console.log('[AuthContext] Токен оновлено, оновлюю дані користувача...');
      // Оновлюємо дані користувача після успішного refresh токену
      refreshUser().catch((error) => {
        console.error('[AuthContext] Помилка оновлення користувача після refresh:', error);
      });
    };

    // Встановлюємо callback
    setOnTokenRefreshed(handleTokenRefreshed);

    // Також слухаємо window events (для додаткової надійності)
    const handleTokenRefreshedEvent = (event: CustomEvent) => {
      console.log('[AuthContext] Отримано подію tokenRefreshed, оновлюю дані користувача...');
      refreshUser().catch((error) => {
        console.error('[AuthContext] Помилка оновлення користувача після refresh:', error);
      });
    };

    const handleTokenRefreshFailed = () => {
      console.warn('[AuthContext] Оновлення токену не вдалося, очищаю дані користувача');
      tokenStorage.remove();
      setUser(null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('tokenRefreshed', handleTokenRefreshedEvent as EventListener);
      window.addEventListener('tokenRefreshFailed', handleTokenRefreshFailed);
    }

    return () => {
      setOnTokenRefreshed(null);
      if (typeof window !== 'undefined') {
        window.removeEventListener('tokenRefreshed', handleTokenRefreshedEvent as EventListener);
        window.removeEventListener('tokenRefreshFailed', handleTokenRefreshFailed);
      }
    };
  }, [refreshUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const response = await authApi.signIn({ email, password });
      tokenStorage.set(response.access_token, response.refresh_token);
      setUser(response.user);
      message.success('Вхід виконано успішно');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Помилка входу';
      message.error(errorMessage);
      throw error;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      await authApi.signUp({ email, password });
      message.success('Реєстрація успішна. Будь ласка, увійдіть');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Помилка реєстрації';
      message.error(errorMessage);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const token = tokenStorage.get();
      if (token) {
        await authApi.signOut(token);
      }
    } catch (error) {
      console.error('Failed to sign out:', error);
    } finally {
      tokenStorage.remove();
      setUser(null);
      message.success('Вихід виконано');
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

