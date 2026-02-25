import axios, { AxiosInstance } from 'axios';

/**
 * Отримує URL бекенду з нормалізацією (прибирає зайвий слеш в кінці)
 */
function getBackendUrl(): string {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  // Прибираємо зайвий слеш в кінці URL
  const normalizedUrl = url.replace(/\/+$/, '');
  
  // Логування для дебагу (тільки в development)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[Backend API] Backend URL:', normalizedUrl);
    console.log('[Backend API] NEXT_PUBLIC_BACKEND_URL from env:', process.env.NEXT_PUBLIC_BACKEND_URL);
  }
  
  return normalizedUrl;
}

const BACKEND_URL = getBackendUrl();

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: any;
}

export interface Agent {
  id: string;
  name?: string;
  url?: string;
  tunnel_url?: string;
  status: string;
  last_seen?: string;
  /** 0 = прихований, 1 або null = видимий */
  visibility?: number | null;
  created_at?: string;
  updated_at?: string;
}

/** Емулятор з бекенду (БД) для управління видимістю */
export interface BackendEmulator {
  id: string;
  agent_id: string;
  emulator_id: string;
  emulator_name?: string;
  device_name?: string;
  udid?: string;
  memu_name?: string;
  status: string;
  /** 0 або null = прихований, 1 = видимий */
  visibility?: number | null;
  /** Шаблон для клонування */
  is_template?: boolean;
  /** new, ready, in_use */
  readiness_status?: string;
  last_seen?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExecutionHistory {
  id: string;
  user_id?: string;
  agent_id: string;
  platform: string;
  action: string;
  emulator_id: string;
  emulator_name?: string;
  account_id?: string;
  account?: {
    id: string;
    username: string;
    email?: string;
    platform: string;
    status: string;
  } | null;
  params?: any;
  result?: any;
  screenshot_url?: string;
  status: string;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
}

export interface HistoryQuery {
  user_id?: string;
  agent_id?: string;
  platform?: string;
  status?: 'pending' | 'success' | 'error';
  page?: number;
  limit?: number;
}

export interface HistoryResponse {
  data: ExecutionHistory[];
  total: number;
  page: number;
  limit: number;
}

export interface Post {
  id: string;
  user_id?: string;
  platform: string;
  account_id?: string;
  execution_history_id?: string;
  post_url: string;
  caption?: string;
  media_path?: string;
  published?: boolean;
  created_at: string;
}

export interface PostLike {
  id: string;
  user_id?: string;
  post_id: string;
  account_id: string;
  execution_history_id?: string;
  status: string;
  liked_at?: string;
  created_at: string;
}

// Глобальний instance axios з interceptor
// baseURL буде оновлюватися динамічно через createBackendApi
const globalAxiosInstance = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Логування початкового URL для дебагу
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[Backend API] Initialized with baseURL:', BACKEND_URL);
}

// Стан для блокування паралельних refresh запитів
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

// Callback для оповіщення про успішний refresh токену
let onTokenRefreshed: ((token: string) => void) | null = null;

export function setOnTokenRefreshed(callback: ((token: string) => void) | null) {
  onTokenRefreshed = callback;
}

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
}

// Request interceptor для автоматичного додавання токену
globalAxiosInstance.interceptors.request.use(
  (config) => {
    // Не додаємо токен для auth endpoints (крім /me та /api-keys)
    if (
      config.url?.startsWith('/api/auth/') &&
      !config.url.includes('/me') &&
      !config.url.includes('/api-keys')
    ) {
      return config;
    }

    // Додаємо токен з localStorage
    const token = tokenStorage.get();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Додаємо interceptor один раз для глобального instance
globalAxiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Якщо помилка 401 і це не refresh endpoint, спробуємо оновити токен
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url === '/api/auth/refresh' || originalRequest.url?.includes('/api/auth/refresh')) {
        // Якщо це сам refresh endpoint повернув 401 - виходимо
        console.warn('[API] Refresh token також недійсний, вимагаємо повторного входу');
        tokenStorage.remove();
        processQueue(error, null);
        
        // Оповіщаємо про невдалий refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tokenRefreshFailed'));
        }
        
        return Promise.reject(error);
      }

      // Перевіряємо чи є refresh token
      const refreshToken = tokenStorage.getRefresh();
      if (!refreshToken) {
        console.warn('[API] Немає refresh token, вимагаємо повторного входу');
        tokenStorage.remove();
        
        // Оповіщаємо про невдалий refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tokenRefreshFailed'));
        }
        
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      // Якщо вже відбувається refresh, додаємо запит в чергу
      if (isRefreshing) {
        console.log('[API] Refresh вже виконується, додаю запит в чергу...');
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            console.log('[API] Отримано новий токен з черги, повторюю запит...');
            originalRequest.headers.Authorization = `Bearer ${token}`;
            // Оновлюємо токен в config для повторного запиту
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return globalAxiosInstance(originalRequest);
          })
          .catch((err) => {
            console.error('[API] Помилка при повторному виконанні запиту з черги:', err);
            return Promise.reject(err);
          });
      }

      isRefreshing = true;

      try {
        console.log('[API] Оновлюю токен через refresh token...');
        const response = await authApi.refresh(refreshToken);
        const { access_token, refresh_token: newRefreshToken } = response;

        tokenStorage.set(access_token, newRefreshToken);
        processQueue(null, access_token);

        // Оповіщаємо про успішний refresh токену
        if (onTokenRefreshed) {
          try {
            onTokenRefreshed(access_token);
          } catch (callbackError) {
            console.warn('[API] Помилка в callback onTokenRefreshed:', callbackError);
          }
        }

        // Викликаємо window event для оповіщення інших частин додатку
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tokenRefreshed', { detail: { token: access_token } }));
        }

        console.log('[API] ✅ Токен успішно оновлено');

        // Оновлюємо заголовок і повторюємо оригінальний запит
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        // Видаляємо _retry прапорець для можливості повторного refresh якщо потрібно
        delete originalRequest._retry;
        
        console.log(`[API] Повторюю оригінальний запит: ${originalRequest.method?.toUpperCase()} ${originalRequest.url}`);
        return globalAxiosInstance(originalRequest);
      } catch (refreshError: any) {
        console.error('[API] ❌ Помилка оновлення токену:', refreshError?.response?.data || refreshError?.message);
        processQueue(refreshError, null);
        tokenStorage.remove();
        
        // Оповіщаємо про невдалий refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tokenRefreshFailed'));
        }
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

function createBackendApi(token?: string): AxiosInstance {
  // Завжди оновлюємо baseURL з поточної змінної середовища
  // Це важливо для Next.js, де змінні можуть змінюватися після збірки
  const currentBackendUrl = getBackendUrl();
  if (globalAxiosInstance.defaults.baseURL !== currentBackendUrl) {
    globalAxiosInstance.defaults.baseURL = currentBackendUrl;
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('[Backend API] Updated baseURL to:', currentBackendUrl);
    }
  }
  // Використовуємо глобальний instance (токен додається автоматично через request interceptor)
  // Якщо передано token явно - можемо перезаписати для конкретного запиту
  return globalAxiosInstance;
}

// Авторизація (без токену)
export const authApi = {
  async signIn(data: SignInRequest): Promise<AuthResponse> {
    const api = createBackendApi();
    const response = await api.post<AuthResponse>('/api/auth/signin', data);
    return response.data;
  },

  async signUp(data: SignUpRequest): Promise<any> {
    const api = createBackendApi();
    const response = await api.post('/api/auth/signup', data);
    return response.data;
  },

  async signOut(token: string): Promise<void> {
    const api = createBackendApi(token);
    await api.post('/api/auth/signout');
  },

  async getMe(token: string): Promise<any> {
    const api = createBackendApi(token);
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  async refresh(refreshToken: string): Promise<AuthResponse> {
    // Refresh запити не повинні мати Authorization заголовок
    const api = createBackendApi();
    const response = await api.post<AuthResponse>('/api/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  // API ключі
  async createApiKey(data: CreateApiKeyDto): Promise<CreateApiKeyResponse> {
    const api = createBackendApi();
    const response = await api.post<CreateApiKeyResponse>('/api/auth/api-keys', data);
    return response.data;
  },

  async getApiKeys(): Promise<ApiKey[]> {
    const api = createBackendApi();
    const response = await api.get<ApiKey[]>('/api/auth/api-keys');
    return response.data;
  },

  async deleteApiKey(id: string): Promise<{ message: string }> {
    const api = createBackendApi();
    const response = await api.delete<{ message: string }>(`/api/auth/api-keys/${id}`);
    return response.data;
  },
};

// API клієнт з токеном
export function createBackendClient(token: string) {
  const api = createBackendApi(token);

  return {
    // Агенти
    async getAgents(): Promise<Agent[]> {
      const response = await api.get<Agent[]>('/api/agents');
      return response.data;
    },

    async getAgent(id: string): Promise<Agent> {
      const response = await api.get<Agent>(`/api/agents/${id}`);
      return response.data;
    },

    async updateAgent(id: string, data: Partial<Pick<Agent, 'name' | 'url' | 'tunnel_url' | 'status' | 'visibility'>>): Promise<Agent> {
      const response = await api.put<Agent>(`/api/agents/${id}`, data);
      return response.data;
    },

    /** Список емуляторів з БД бекенду (для управління видимістю). */
    async getBackendEmulators(params?: { agent_id?: string; include_hidden?: boolean }): Promise<BackendEmulator[]> {
      const query: Record<string, string> = {};
      if (params?.agent_id) query.agent_id = params.agent_id;
      if (params?.include_hidden) query.include_hidden = 'true';
      const response = await api.get<BackendEmulator[]>('/api/emulators', { params: query });
      return response.data;
    },

    async updateEmulator(id: string, data: Partial<Pick<BackendEmulator, 'emulator_name' | 'device_name' | 'status' | 'visibility' | 'is_template' | 'readiness_status'>>): Promise<BackendEmulator> {
      const response = await api.put<BackendEmulator>(`/api/emulators/${id}`, data);
      return response.data;
    },

    async deleteEmulator(id: string): Promise<void> {
      await api.delete(`/api/emulators/${id}`);
    },

    async cloneEmulators(templateEmulatorId: string, count: number = 1): Promise<{ ok: boolean; count: number }> {
      const response = await api.post<{ ok: boolean; count: number }>('/api/emulators/clone', {
        template_emulator_id: templateEmulatorId,
        count,
      });
      return response.data;
    },

    // Проксування метаданих (через бекенд)
    async getHealth(agentId: string): Promise<any> {
      const response = await api.get(`/api/proxy/${agentId}/health`);
      return response.data;
    },

    async getPlatforms(agentId: string): Promise<any> {
      const response = await api.get(`/api/proxy/${agentId}/platforms`);
      return response.data;
    },

    async getPlatformActions(agentId: string, platform: string): Promise<any> {
      const response = await api.get(`/api/proxy/${agentId}/platforms/${platform}`);
      return response.data;
    },

    async getEmulators(agentId: string): Promise<any> {
      const response = await api.get(`/api/proxy/${agentId}/emulators`);
      return response.data;
    },

    /** Емулятори з БД (тільки з активних агентів за last_seen). */
    async getAllEmulators(params?: {
      include_hidden?: boolean;
      active_within_minutes?: number;
      exclude_templates?: boolean;
      readiness_status?: string;
    }): Promise<{
      emulators: Array<Record<string, any> & { agent_id: string; agent_name?: string }>;
    }> {
      const query: Record<string, string> = {};
      if (params?.include_hidden) query.include_hidden = 'true';
      if (params?.active_within_minutes != null && params.active_within_minutes > 0) {
        query.active_within_minutes = String(params.active_within_minutes);
      }
      if (params?.exclude_templates) query.exclude_templates = 'true';
      if (params?.readiness_status) query.readiness_status = params.readiness_status;
      const response = await api.get<any[]>('/api/emulators', {
        params: Object.keys(query).length ? query : undefined,
      });
      const list = Array.isArray(response.data) ? response.data : [];
      return { emulators: list };
    },

    // Виконання дій
    async executeAction(
      agentId: string,
      platform: string,
      action: string,
      data: { emulatorId: string; params?: any },
    ): Promise<any> {
      const response = await api.post(
        `/api/execute/${agentId}/${platform}/${action}`,
        data,
      );
      return response.data;
    },

    // Історія
    async getHistory(query: HistoryQuery = {}): Promise<HistoryResponse> {
      const response = await api.get<HistoryResponse>('/api/history', {
        params: query,
      });
      return response.data;
    },

    async getHistoryRecord(id: string): Promise<ExecutionHistory> {
      const response = await api.get<ExecutionHistory>(`/api/history/${id}`);
      return response.data;
    },

    async getHistoryStats(agentId?: string, userId?: string): Promise<any> {
      const response = await api.get('/api/history/stats', {
        params: { agent_id: agentId, user_id: userId },
      });
      return response.data;
    },

      // Пости та лайки
      async getPosts(query?: {
        platform?: string;
        page?: number;
        limit?: number;
      }): Promise<{ data: Post[]; total: number; page: number; limit: number }> {
        const cleanedQuery = Object.fromEntries(
          Object.entries(query || {}).filter(([, value]) => value !== undefined),
        );
        const response = await api.get<{ data: Post[]; total: number; page: number; limit: number }>(
          '/api/posts',
          { params: cleanedQuery },
        );
        return response.data;
      },

      async getPostLikes(postId: string): Promise<PostLike[]> {
        const response = await api.get<PostLike[]>(`/api/posts/${postId}/likes`);
        return response.data;
      },

    // Синхронізація агентів
    async syncAgents(): Promise<{ message: string }> {
      const response = await api.post('/api/sync/agents');
      return response.data;
    },

    // Черга задач
    async getQueue(query: {
      status?: string;
      platform?: string;
      agent_id?: string;
      page?: number;
      limit?: number;
    } = {}): Promise<{
      data: Task[];
      total: number;
      page: number;
      limit: number;
      stats?: {
        total: number;
        pending: number;
        processing: number;
        completed: number;
        failed: number;
      };
    }> {
      // Видаляємо undefined значення перед відправкою
      const cleanQuery: any = {};
      if (query.status !== undefined) cleanQuery.status = query.status;
      if (query.platform !== undefined) cleanQuery.platform = query.platform;
      if (query.agent_id !== undefined) cleanQuery.agent_id = query.agent_id;
      if (query.page !== undefined) cleanQuery.page = query.page;
      if (query.limit !== undefined) cleanQuery.limit = query.limit;
      
      const response = await api.get('/api/queue', { params: cleanQuery });
      return response.data;
    },

    async getTask(id: string): Promise<Task> {
      const response = await api.get<Task>(`/api/queue/${id}`);
      return response.data;
    },

    async addTask(data: {
      platform: string;
      action: string;
      params?: any;
      account_id?: string;
      emulator_id?: string;
      emulator_type?: string;
      agent_id?: string;
      priority?: number;
      requireSession?: boolean;
      country_code?: string | null;
    }): Promise<Task> {
      const response = await api.post<Task>('/api/queue/add', data);
      return response.data;
    },

      async cancelTask(id: string): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(`/api/queue/${id}`);
        return response.data;
      },

      async retryTask(id: string): Promise<{ message: string; task: Task }> {
        const response = await api.post<{ message: string; task: Task }>(`/api/queue/${id}/retry`);
        return response.data;
      },

      // Довідник країн
      async getCountries(): Promise<{ code: string; name: string }[]> {
        const response = await api.get<{ code: string; name: string }[]>('/api/countries');
        return response.data;
      },

      // Соціальні аккаунти
      async createSocialAccount(data: CreateSocialAccountDto): Promise<SocialAccount> {
        const response = await api.post<SocialAccount>('/api/social-accounts', data);
        return response.data;
      },

      async getSocialAccounts(query?: {
        platform?: string;
        status?: string;
        requires_proxy?: boolean;
        page?: number;
        limit?: number;
      }): Promise<{ data: SocialAccount[]; total: number; page: number; limit: number }> {
        const cleanedQuery = Object.fromEntries(
          Object.entries(query || {}).filter(([, value]) => value !== undefined)
        );
        const response = await api.get<{ data: SocialAccount[]; total: number; page: number; limit: number }>(
          '/api/social-accounts',
          { params: cleanedQuery }
        );
        return response.data;
      },

      async getSocialAccount(id: string): Promise<SocialAccount> {
        const response = await api.get<SocialAccount>(`/api/social-accounts/${id}`);
        return response.data;
      },

      async updateSocialAccount(id: string, data: UpdateSocialAccountDto): Promise<SocialAccount> {
        const response = await api.put<SocialAccount>(`/api/social-accounts/${id}`, data);
        return response.data;
      },

      async deleteSocialAccount(id: string): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(`/api/social-accounts/${id}`);
        return response.data;
      },

      async unblockSocialAccount(id: string): Promise<{ ok: boolean; message: string; account: SocialAccount }> {
        const response = await api.post<{ ok: boolean; message: string; account: SocialAccount }>(
          `/api/social-accounts/${id}/unblock`
        );
        return response.data;
      },

      // Проксі аккаунтів
      async createProxy(data: CreateProxyDto): Promise<AccountProxy> {
        const response = await api.post<AccountProxy>('/api/account-proxies', data);
        return response.data;
      },

      async getProxyForAccount(accountId: string): Promise<AccountProxy | null> {
        const response = await api.get<AccountProxy>(`/api/account-proxies/account/${accountId}`);
        return response.data;
      },

      async updateProxy(id: string, data: Partial<AccountProxy>): Promise<AccountProxy> {
        const response = await api.put<AccountProxy>(`/api/account-proxies/${id}`, data);
        return response.data;
      },

      async checkProxyHealth(id: string): Promise<{ healthy: boolean }> {
        const response = await api.post<{ healthy: boolean }>(`/api/account-proxies/${id}/check`);
        return response.data;
      },

      // Прив'язки аккаунтів до емуляторів
      async createBinding(
        data: CreateBindingDto,
      ): Promise<AccountEmulatorBinding | { taskId: string; status: string; message: string }> {
        const response = await api.post<
          AccountEmulatorBinding | { taskId: string; status: string; message: string }
        >('/api/account-bindings', data);
        return response.data;
      },

      async getBindingForAccount(accountId: string): Promise<AccountEmulatorBinding | null> {
        const response = await api.get<AccountEmulatorBinding>(`/api/account-bindings/account/${accountId}`);
        return response.data;
      },

      async getBindingsForEmulator(emulatorId: string): Promise<AccountEmulatorBinding[]> {
        const response = await api.get<AccountEmulatorBinding[]>(`/api/account-bindings/emulator/${emulatorId}`);
        return response.data;
      },

      async getOccupiedEmulatorsByPlatform(platform: string): Promise<OccupiedEmulatorsResponse> {
        const response = await api.get<OccupiedEmulatorsResponse>('/api/account-bindings/occupied', {
          params: { platform },
        });
        return response.data;
      },

      async updateBinding(id: string, data: Partial<AccountEmulatorBinding>): Promise<AccountEmulatorBinding> {
        const response = await api.put<AccountEmulatorBinding>(`/api/account-bindings/${id}`, data);
        return response.data;
      },

      async deleteBinding(id: string): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(`/api/account-bindings/${id}`);
        return response.data;
      },

      async deleteBindingByAccount(accountId: string): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(`/api/account-bindings/account/${accountId}`);
        return response.data;
      },

      // Jobs (задачі)
      async triggerJobWebhook(jobName: string, params?: any): Promise<any> {
        const response = await api.post(`/api/jobs/webhook/${jobName}`, { params });
        return response.data;
      },

      async executeJob(jobName: string, params?: any): Promise<any> {
        const response = await api.post(`/api/jobs/${jobName}/execute`, { params });
        return response.data;
      },

      // API ключі
      async getApiKeys(): Promise<ApiKey[]> {
        const response = await api.get<ApiKey[]>('/api/auth/api-keys');
        return response.data;
      },

      async createApiKey(data: CreateApiKeyDto): Promise<CreateApiKeyResponse> {
        const response = await api.post<CreateApiKeyResponse>('/api/auth/api-keys', data);
        return response.data;
      },

      async deleteApiKey(id: string): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(`/api/auth/api-keys/${id}`);
        return response.data;
      },

      // Капчі
      async getCaptchas(query?: {
        status?: 'waiting' | 'solved' | 'timeout' | 'cancelled';
        platform?: string;
        page?: number;
        limit?: number;
      }): Promise<{
        data: CaptchaRequest[];
        total: number;
        page: number;
        limit: number;
      }> {
        const cleanedQuery = Object.fromEntries(
          Object.entries(query || {}).filter(([, value]) => value !== undefined)
        );
        const response = await api.get<{
          data: CaptchaRequest[];
          total: number;
          page: number;
          limit: number;
        }>('/api/instagram/captcha', { params: cleanedQuery });
        return response.data;
      },

      async getCaptchaStatus(captchaId: string): Promise<{
        id: string;
        status: string;
        code?: string;
        expires_at: string;
      }> {
        const response = await api.get(`/api/instagram/captcha/${captchaId}/status`);
        return response.data;
      },

      async submitCaptchaCode(captchaId: string, code: string): Promise<{
        ok: boolean;
        captchaId: string;
        status: string;
        code?: string;
      }> {
        const response = await api.post(`/api/instagram/captcha/${captchaId}/submit`, { code });
        return response.data;
      },

      async getCaptchaScreenshotUrl(captchaId: string): Promise<{ url: string }> {
        const response = await api.get(`/api/instagram/captcha/${captchaId}/screenshot`);
        return response.data;
      },

      // Додати Instagram пост для лайку
      async likeInstagramPost(data: {
        postUrl: string;
      }): Promise<{
        ok: boolean;
        message: string;
        post: Post;
      }> {
        const response = await api.post('/api/posts/instagram/like', data);
        return response.data;
      },

      // Чорний список задач
      async getBlacklist(): Promise<BlacklistEntry[]> {
        const response = await api.get<BlacklistEntry[]>('/api/queue/blacklist');
        return response.data;
      },

      async getBlacklistEntry(id: string): Promise<BlacklistEntry> {
        const response = await api.get<BlacklistEntry>(`/api/queue/blacklist/${id}`);
        return response.data;
      },

      async createBlacklistEntry(data: CreateBlacklistEntryDto): Promise<BlacklistEntry> {
        const response = await api.post<BlacklistEntry>('/api/queue/blacklist', data);
        return response.data;
      },

      async updateBlacklistEntry(id: string, data: UpdateBlacklistEntryDto): Promise<BlacklistEntry> {
        const response = await api.put<BlacklistEntry>(`/api/queue/blacklist/${id}`, data);
        return response.data;
      },

      async deleteBlacklistEntry(id: string): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(`/api/queue/blacklist/${id}`);
        return response.data;
      },

      async addTaskToBlacklist(taskId: string, reason?: string): Promise<BlacklistEntry> {
        const response = await api.post<BlacklistEntry>(`/api/queue/blacklist/from-task/${taskId}`, { reason });
        return response.data;
      },
    };
  }

// Інтерфейси для черги
export interface Task {
  id: string;
  user_id?: string;
  platform: string;
  action: string;
  params?: any;
  account_id?: string;
  account?: {
    id: string;
    username: string;
    email?: string;
    platform: string;
    status: string;
  } | null;
  proxy_id?: string;
  emulator_id?: string;
  emulator_type?: string;
  agent_id?: string;
  status: 'pending' | 'assigned' | 'processing' | 'completed' | 'failed' | 'cancelled';
  assigned_agent_id?: string;
  assigned_emulator_id?: string;
  priority: number;
  created_at: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
  result?: any;
  error_message?: string;
  duration_ms?: number;
  country_code?: string | null;
  country_name?: string | null;
}

export interface SocialAccount {
  id: string;
  user_id?: string;
  platform: string;
  username: string;
  email?: string;
  phone?: string;
  requires_proxy: boolean;
  proxy_required_reason?: string;
  status: string;
  account_status_reason?: string;
  last_activity?: string;
  last_login_at?: string;
  total_tasks: number;
  successful_tasks: number;
  failed_tasks: number;
  failed_logins: number;
  last_ban_date?: string;
  blocked_until?: string; // Timestamp until which account is temporarily blocked
  country_code?: string | null;
  country_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSocialAccountDto {
  platform: string;
  username: string;
  email?: string;
  phone?: string;
  password: string;
  two_factor_secret?: string;
  requires_proxy?: boolean;
  proxy_required_reason?: string;
  country_code?: string | null;
}

export interface UpdateSocialAccountDto {
  platform?: string;
  username?: string;
  email?: string;
  phone?: string;
  password?: string;
  two_factor_secret?: string;
  requires_proxy?: boolean;
  proxy_required_reason?: string;
  status?: string;
  account_status_reason?: string;
  country_code?: string | null;
}

export interface AccountProxy {
  id: string;
  account_id: string;
  proxy_host: string;
  proxy_port: number;
  proxy_type: string;
  proxy_username?: string;
  status: string;
  last_check?: string;
  last_success?: string;
  consecutive_failures: number;
  total_requests: number;
  failed_requests: number;
  avg_response_time_ms?: number;
  ban_count: number;
  bound_at: string;
  updated_at: string;
}

export interface CreateProxyDto {
  account_id: string;
  proxy_host: string;
  proxy_port: number;
  proxy_type?: string;
  proxy_username?: string;
  proxy_password?: string;
}

export interface AccountEmulatorBinding {
  id: string;
  account_id: string;
  emulator_id: string;
  status: string;
  binding_type: string;
  session_data?: any;
  session_expires_at?: string;
  last_session_refresh?: string;
  bound_at: string;
  last_used_at?: string;
  last_task_at?: string;
  notes?: string;
}

export interface CreateBindingDto {
  account_id: string;
  emulator_id: string;
  binding_type?: string;
  notes?: string;
  verifyLogin?: boolean;
}

export interface OccupiedEmulatorsResponse {
  emulator_ids: string[];
}

// API ключі
export interface ApiKey {
  id: string;
  name?: string;
  last_used_at?: string;
  created_at: string;
  expires_at?: string;
}

export interface CreateApiKeyDto {
  name?: string;
}

export interface CreateApiKeyResponse {
  api_key: string;
  name: string;
  created_at: string;
  message: string;
}

// Капчі
export interface CaptchaRequest {
  id: string;
  account_id?: string;
  task_id?: string;
  agent_id?: string;
  emulator_id?: string;
  platform: string;
  screenshot_url: string;
  status: 'waiting' | 'solved' | 'timeout' | 'cancelled';
  code?: string;
  telegram_message_id?: number;
  telegram_chat_id?: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
  account?: {
    id: string;
    username: string;
    email?: string;
    platform: string;
    status: string;
  } | null;
}

// Чорний список
export interface BlacklistEntry {
  id: string;
  user_id?: string;
  platform: string;
  action: string;
  params?: any;
  account_id?: string;
  emulator_id?: string;
  agent_id?: string;
  reason?: string;
  created_at: string;
  created_by?: string;
  match_params_exactly: boolean;
  is_active: boolean;
}

export interface CreateBlacklistEntryDto {
  platform: string;
  action: string;
  params?: any;
  account_id?: string;
  emulator_id?: string;
  agent_id?: string;
  reason?: string;
  match_params_exactly?: boolean;
  user_id?: string;
}

export interface UpdateBlacklistEntryDto {
  reason?: string;
  is_active?: boolean;
  match_params_exactly?: boolean;
}

// Зберігання токенів
export const tokenStorage = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  },

  getRefresh(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh_token');
  },

  set(token: string, refreshToken?: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('auth_token', token);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }
  },

  remove(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  },
};

