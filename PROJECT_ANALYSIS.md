# Детальний аналіз проекту Nexus Labs Frontend

## 📋 Загальний опис

**Nexus Labs Frontend** — Next.js веб-додаток для управління агентами, емуляторами, чергою завдань, соціальними аккаунтами, постами, історією виконання. Інтегрується з **backend** через REST API. **Усі дані доступні тільки залогіненому користувачу.**

---

## 🏗️ Архітектура

### Технологічний стек

- **Next.js** (App Router) — React фреймворк
- **TypeScript** — мова програмування
- **React 19** — UI бібліотека
- **Ant Design** — UI компоненти
- **Axios** — HTTP клієнт
- **Tailwind CSS** — стилізація

### Структура проекту

```
frontend/
├── app/                      # Next.js App Router
│   ├── (public)/            # Публічні: login, register
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── accounts/            # Соціальні аккаунти
│   ├── blacklist/           # Чорний список задач
│   ├── captcha/             # Капча
│   ├── emulators/           # Список емуляторів
│   │   └── [id]/            # Деталі емулятора
│   ├── history/             # Історія виконання
│   ├── platforms/           # Платформи та дії
│   │   ├── [platform]/      # Динамічні сторінки
│   │   ├── instagram/       # instagram/post, login, like
│   │   ├── youtube/search/
│   │   ├── tiktok/watch/
│   │   └── ...
│   ├── posts/               # Пости та лайки
│   ├── queue/               # Черга завдань
│   ├── api-keys/            # API ключі
│   ├── api/agents/          # API route (Cloudflare KV, legacy)
│   ├── layout.tsx
│   └── page.tsx             # Dashboard
├── components/
│   ├── Agents/              # AgentSelector
│   ├── accounts/            # CreateAccountModal, EditAccountModal, AccountDetailsDrawer
│   ├── auth/                # ProtectedRoute
│   ├── common/              # ErrorDisplay, Loading, CountrySelect
│   ├── Layout/              # AppLayout, AppHeader
│   └── platforms/           # ActionFormWrapper, AccountEmulatorSelector
├── contexts/
│   ├── AgentsContext.tsx    # Агенти, activeAgent, load з backend
│   └── AuthContext.tsx      # user, signIn, signOut, refreshUser
├── hooks/
│   ├── useBackendAgentApi.ts
│   ├── useAllEmulators.ts
│   ├── useAgentApi.ts
│   ├── useBackendApi.ts
│   ├── useActiveAgentApi.ts
│   ├── useAccountEmulatorSelection.ts
│   ├── useCountries.ts
│   └── useTunnelUrl.ts
├── lib/api/
│   ├── backend.ts           # Головний API клієнт до backend
│   ├── agent.ts             # Прямі виклики агента (legacy?)
│   └── cloudflare-kv.ts     # Cloudflare KV (legacy)
├── types/
│   └── agent.ts
└── utils/
```

---

## 🔐 Авторизація та доступ до даних

### Обов'язкова авторизація

- **Не залогінений** — не отримує жодних даних (agents=[], редирект на /login для захищених роутів)
- **Залогінений** — всі дані з backend через REST API

### Token Management

- **localStorage**: `auth_token`, `refresh_token`
- **Interceptor**: автоматичне оновлення access token при 401
- **tokenStorage** (`lib/api/backend.ts`): get(), set(), remove(), getRefresh()

---

## 🤝 Контракт Frontend ↔ Backend

### Джерело даних

| Дані | Endpoint | Примітка |
|------|----------|----------|
| Агенти | `GET /api/agents` | Тільки видимі (visibility≠0). `?include_hidden=true` для всіх |
| Емулятори | `GET /api/emulators`, `GET /api/emulators/:id` | Деталі емулятора — getEmulator(id) |
| Виконання | `POST /api/execute/:agentId/:platform/:action` або `POST /api/queue` | |
| Історія | `GET /api/history` | Підтримка фільтрів `emulator_id`, `agent_id` |
| Черга | `GET/POST /api/queue` | Підтримка фільтрів `emulator_id`, `agent_id` |
| Аккаунти, пости, captcha, blacklist | Відповідні `/api/*` | Див. backend PROJECT_ANALYSIS |

### Типи (синхронізувати з backend)

- **Agent**: id, name, url, tunnel_url, status, visibility, created_at
- **BackendEmulator**: id, agent_id, emulator_id, visibility, is_template, readiness_status
- **Task**, **ExecutionHistory**, **Post**, **PostLike**, **SocialAccount** — у `backend.ts`

---

## 📄 Сторінки та роути

### Публічні

- `/login` — вхід
- `/register` — реєстрація

### Захищені (ProtectedRoute)

| Роут | Опис |
|------|------|
| `/` | Dashboard — платформи, емулятори, статистика |
| `/users` | Користувачі та ролі (тільки admin/superadmin) |
| `/access-control` | Адмінка доступів: ролі, права ролей, user overrides, effective permissions |
| `/platforms` | Список платформ |
| `/platforms/[platform]` | Деталі платформи, список дій |
| `/platforms/[platform]/[action]` | Динамічна форма дії |
| `/platforms/instagram/post` | Instagram: публікація |
| `/platforms/instagram/login` | Instagram: логін |
| `/platforms/instagram/like` | Instagram: лайк |
| `/platforms/facebook/marketplacePost` | Facebook: Marketplace post (dedicated form) |
| `/platforms/youtube/search` | YouTube: пошук |
| `/platforms/tiktok/watch` | TikTok: перегляд |
| `/emulators` | Список емуляторів (з backend) |
| `/emulators/[id]` | Деталі емулятора: інформація, прив'язані аккаунти, черга, історія |
| `/accounts` | Соціальні аккаунти |
| `/queue` | Черга завдань |
| `/history` | Історія виконання |
| `/posts` | Пости та лайки |
| `/captcha` | Капча |
| `/api-keys` | API ключі |
| `/blacklist` | Чорний список задач |

---

## 🧩 Facebook Marketplace (Nexus Labs)

- У frontend додано dedicated-форму для задачі `facebook/marketplacePost`:
  - сторінка: `/platforms/facebook/marketplacePost`
  - entry points: `/platforms` (Facebook card) і `/platforms/facebook`
- Форма збирає параметри:
  - `title` (required), `description` (required), `price` (required)
  - `imageUrls`, `imagePaths`, `location`, `category` (optional)
- Submit використовує існуючий queue flow через `createBackendClient(...).addTask` (та helper `addFacebookMarketplaceTask`), без змін backend endpoint-ів.

---

## 🔧 Ключові модулі

### 1. AgentsContext

- **Джерело агентів**: Backend `GET /api/agents` (тільки видимі). Без авторизації — порожній список.
- **loadAgentsFromBackend()**: завантажує з backend, мапить до frontend Agent, зберігає в state та localStorage (кеш)
- **refreshAgents**: викликає loadAgentsFromBackend
- **updateAgentOnBackend**: оновлює видимість, потім перезавантажує список
- **addAgent, deleteAgent**: локальні (для майбутнього створення через backend?)

### 2. AuthContext

- **user** (id, email, role), **loading**
- **signIn**, **signUp**, **signOut**, **refreshUser**
- Підписка на `tokenRefreshFailed`, оновлення після refresh токену

### 3. API клієнт (lib/api/backend.ts)

- **createBackendApi(token)** — базовий axios з токеном
- **createBackendClient(token)** — повний клієнт: auth, agents, emulators, execute, history, queue, posts, social-accounts, account-proxies, account-bindings, sync
- **authApi** — signIn, signUp, signOut, getMe, refresh, api-keys, getUsers, setUserRole, permissions API (`/api/permissions/*`)
- **tokenStorage** — get, set, remove, getRefresh

### 4. Hooks

- **useBackendAgentApi** — backendClient, activeAgent, isConnected
- **useAllEmulators** — емулятори з GET /api/emulators (onlyActive, includeHidden, forTasksAndBinding)
- **useAgentApi** — executeAction через backend
- **useAccountEmulatorSelection** — вибір аккаунту та емулятора для задач
- **useCountries** — список країн

---

## ⚙️ Конфігурація

### Змінні середовища (`.env.local`)

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_USE_TUNNEL=true
# Cloudflare KV (legacy, опціонально)
NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID=
NEXT_PUBLIC_CLOUDFLARE_API_TOKEN=
NEXT_PUBLIC_CLOUDFLARE_KV_NAMESPACE_ID=
```

---

## 📊 LocalStorage

| Ключ | Опис |
|------|------|
| `auth_token` | Access token |
| `refresh_token` | Refresh token |
| `android-farm-agents` | Кеш агентів (тільки при залогіненому) |
| `android-farm-active-agent-id` | ID активного агента |

---

## 🛡️ Безпека

- **ProtectedRoute** — редирект на /login для неавторизованих
- **Bearer token** — у заголовку Authorization
- **X-API-Key** — альтернатива (backend підтримує)
- **Interceptor** — auto-refresh при 401

---

## 🚀 Запуск

```bash
npm install
npm run dev    # http://localhost:3001
npm run build && npm start
```

---

## 📚 Розширення

### Додавання нової сторінки платформи/дії

1. `app/platforms/[platform]/[action]/page.tsx` — динамічна форма
2. Або `app/platforms/myplatform/myaction/page.tsx` — спеціалізована
3. Використати `useBackendAgentApi`, `useAccountEmulatorSelection` для execute/queue

### Синхронізація з backend

При зміні типів або endpoints у backend — оновлювати `lib/api/backend.ts` та цей документ. Правило: `.cursor/rules/docs-sync.mdc`

### Access Control (Roles + Permissions)

- Нова сторінка `/access-control` об'єднує керування доступом в Nexus Labs:
  - `Users & Roles` — перегляд користувачів та зміна ролей.
  - `Role Permissions` — CRUD прав ролей.
  - `User Overrides` — CRUD персональних прав користувача.
  - `Effective permissions` — read-only merged view прав користувача.
- Використовує backend endpoints:
  - `GET /api/permissions/catalog`
  - `GET /api/permissions/roles`
  - `PUT /api/permissions/roles`
  - `DELETE /api/permissions/roles/:role/:permissionKey`
  - `GET /api/permissions/users`
  - `PUT /api/permissions/users`
  - `DELETE /api/permissions/users/:userId/:permissionKey`
  - `GET /api/permissions/users/:userId/effective`
- Доступ до сторінки обмежено `admin/superadmin`, а runtime-помилки `403` показуються як readable error-block без падіння UI.

---

## 🔗 Пов'язані документи

- **Backend API**: `backend/PROJECT_ANALYSIS.md`, `backend/README.md`
- **Архітектура**: `AGENTS.md`
- **Skill для AI**: `.cursor/skills/frontend/SKILL.md`
- **Посібник користувача**: `frontend/USER_GUIDE.md`

---

**Останнє оновлення:** 2025-02-25
