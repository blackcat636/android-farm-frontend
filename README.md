# Android Farm Frontend

Frontend панель керування для Android Farm Agent.

## Технології

- **Next.js 14** з App Router
- **TypeScript**
- **Ant Design 5** - UI бібліотека
- **Axios** - HTTP клієнт

## Встановлення

```bash
npm install
```

## Налаштування

Створіть файл `.env.local` в корені проекту:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

За замовчуванням використовується `http://localhost:3000` (порт агента).

## Запуск

### Розробка

```bash
npm run dev
```

Відкрийте [http://localhost:3001](http://localhost:3001) в браузері.

### Продакшн

```bash
npm run build
npm start
```

## Структура проекту

```
frontend/
├── app/                    # Next.js App Router сторінки
│   ├── page.tsx           # Dashboard
│   ├── platforms/         # Сторінки платформ
│   │   ├── page.tsx       # Список платформ
│   │   ├── youtube/       # YouTube платформа
│   │   │   ├── page.tsx
│   │   │   └── search/    # Сторінка для youtube/search
│   │   └── [platform]/    # Динамічні сторінки для інших платформ
│   └── emulators/         # Список емуляторів
├── components/            # React компоненти
│   ├── Layout/           # Layout компоненти
│   └── common/           # Загальні компоненти
├── lib/                  # Бібліотеки
│   └── api/              # API клієнт
├── hooks/                # React hooks
└── utils/                # Утиліти
```

## Додавання нових платформ та дій

### Додавання нової платформи

1. Додайте платформу на бекенді в `agent/platforms/`
2. Фронтенд автоматично підхопить її через API

### Додавання сторінки для дії

Для кожної дії створюється окрема сторінка:

1. Створіть файл `app/platforms/[platform]/[action]/page.tsx` для динамічної форми
2. Або створіть конкретну сторінку, наприклад `app/platforms/youtube/search/page.tsx` для спеціальної форми

Приклад створення сторінки для нової дії:

```typescript
// app/platforms/myplatform/myaction/page.tsx
'use client';

import { Form, Input, Select, Button } from 'antd';
import { useAgentApi } from '@/hooks/useAgentApi';

export default function MyActionPage() {
  const { executeAction, loading } = useAgentApi();
  
  const handleSubmit = async (values: any) => {
    await executeAction('myplatform', 'myaction', {
      emulatorId: values.emulatorId,
      params: {
        // ваші параметри
      },
    });
  };

  return (
    <Form onFinish={handleSubmit}>
      {/* Ваша форма */}
    </Form>
  );
}
```

## API інтеграція

Всі API виклики виконуються через `lib/api/agent.ts`. Використовуйте `useAgentApi` hook для виконання дій:

```typescript
import { useAgentApi } from '@/hooks/useAgentApi';

const { executeAction, loading, error } = useAgentApi();

await executeAction('youtube', 'search', {
  emulatorId: 'emulator-1',
  params: { query: 'test', watchSeconds: 15 },
});
```
