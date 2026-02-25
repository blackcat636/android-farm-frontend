# Android Farm Frontend

Панель керування для Android Farm: агенти, емулятори, черга завдань, соціальні аккаунти, історія.

## Технології

- **Next.js** з App Router
- **TypeScript**
- **Ant Design** — UI
- **Axios** — HTTP клієнт до backend

## Встановлення

```bash
npm install
```

## Налаштування

Створіть `.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

## Запуск

```bash
npm run dev     # http://localhost:3001
npm run build
npm start
```

## Структура

- `app/` — сторінки (platforms, emulators, accounts, queue, history, posts, captcha, blacklist, api-keys)
- `components/` — UI компоненти
- `contexts/` — AuthContext, AgentsContext
- `hooks/` — useBackendAgentApi, useAllEmulators, useAgentApi, useAccountEmulatorSelection
- `lib/api/backend.ts` — API клієнт до backend

## Доступ до даних

**Усі дані доступні тільки залогіненому користувачу.** Агенти, емулятори, черга — все з backend `NEXT_PUBLIC_BACKEND_URL`.

## Документація

- `PROJECT_ANALYSIS.md` — повний аналіз, контракт з backend, структура
- `AGENTS.md` — архітектура всього проєкту
- Backend: `backend/PROJECT_ANALYSIS.md`
