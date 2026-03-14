import axios, { AxiosInstance } from 'axios';

// Типи для API відповідей
export interface HealthResponse {
  ok: boolean;
  time: string;
}

export interface PlatformsResponse {
  ok: boolean;
  platforms: string[];
}

export interface PlatformActionsResponse {
  ok: boolean;
  platform: string;
  actions: string[];
}

export interface Emulator {
  id: string;
  /** ID емулятора з конфігурації (напр. "0", "1"). Для відображення в UI. */
  emulatorId?: string;
  name: string;
  udid: string;
  deviceName: string;
  status: 'active' | 'inactive';
  agentName?: string; // Назва агента (для режиму "всі агенти")
  agentId?: string; // ID агента
  agentBaseURL?: string; // BaseURL агента для виконання дій
}

export interface EmulatorsResponse {
  ok: boolean;
  emulators: Emulator[];
}

export interface ExecuteActionRequest {
  emulatorId: string;
  params?: Record<string, any>;
}

export interface ExecuteActionResponse {
  ok: boolean;
  platform: string;
  action: string;
  emulatorId: string;
  result: any;
}

export interface ErrorResponse {
  error?: string;
  status?: string;
  message?: string;
}

export interface TunnelUrlResponse {
  ok: boolean;
  url?: string;
  message?: string;
}

// Функція для створення клієнтів з динамічним baseURL
function createClients(baseURL: string) {
  // Клієнт для звичайних запитів (короткий timeout)
  const apiClient: AxiosInstance = axios.create({
    baseURL: baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 секунд таймаут
  });

  // Клієнт для довгих операцій (великий timeout)
  const longRunningClient: AxiosInstance = axios.create({
    baseURL: baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 600000, // 10 хвилин таймаут для довгих операцій
  });

  // Додаємо interceptor для логування помилок (для обох клієнтів)
  const errorInterceptor = (error: any) => {
    if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
      console.error('Failed to connect to agent:', baseURL);
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.error('Request timeout. Operation is taking too long.');
    } else {
      console.error('API error:', error.response?.data || error.message);
    }
    return Promise.reject(error);
  };

  apiClient.interceptors.response.use(
    (response) => response,
    errorInterceptor
  );

  longRunningClient.interceptors.response.use(
    (response) => response,
    errorInterceptor
  );

  return { apiClient, longRunningClient };
}

// Функція для створення API об'єкта з конкретним baseURL
export function createAgentApi(baseURL: string) {
  const { apiClient, longRunningClient } = createClients(baseURL);

  return {
    // Healthcheck
    async getHealth(): Promise<HealthResponse> {
      const response = await apiClient.get<HealthResponse>('/health');
      return response.data;
    },

    // Отримати список платформ
    async getPlatforms(): Promise<PlatformsResponse> {
      const response = await apiClient.get<PlatformsResponse>('/api/platforms');
      return response.data;
    },

    // Отримати список дій для платформи
    async getPlatformActions(platform: string): Promise<PlatformActionsResponse> {
      const response = await apiClient.get<PlatformActionsResponse>(`/api/platforms/${platform}`);
      return response.data;
    },

    // Отримати список емуляторів (за замовчуванням — кеш; refresh: true — свіжі дані з ADB)
    async getEmulators(options?: { refresh?: boolean }): Promise<EmulatorsResponse> {
      const params = options?.refresh ? { refresh: '1' } : undefined;
      const response = await apiClient.get<EmulatorsResponse>('/api/emulators', { params });
      return response.data;
    },

    // Виконати дію на платформі (використовуємо longRunningClient для довгих операцій)
    async executeAction(
      platform: string,
      action: string,
      data: ExecuteActionRequest
    ): Promise<ExecuteActionResponse> {
      const response = await longRunningClient.post<ExecuteActionResponse>(
        `/api/${platform}/${action}`,
        data
      );
      return response.data;
    },

    // Отримати URL тунелю (опціонально з agentId)
    async getTunnelUrl(agentId?: string): Promise<TunnelUrlResponse> {
      const params = agentId ? `?agentId=${encodeURIComponent(agentId)}` : '';
      const response = await apiClient.get<TunnelUrlResponse>(`/api/tunnel/url${params}`);
      return response.data;
    },
  };
}

// Дефолтний API клієнт (для зворотної сумісності)
import { API_BASE_URL } from '@/utils/constants';
export const agentApi = createAgentApi(API_BASE_URL);
