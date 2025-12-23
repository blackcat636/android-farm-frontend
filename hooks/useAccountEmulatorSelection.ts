'use client';

import { useState, useEffect } from 'react';
import { message } from 'antd';
import { type Emulator } from '@/lib/api/agent';
import { createBackendClient, tokenStorage, type SocialAccount, type AccountEmulatorBinding } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';

export interface UseAccountEmulatorSelectionProps {
  platform: string;
  loading?: boolean;
}

export interface UseAccountEmulatorSelectionReturn {
  // Стани
  selectionType: 'account' | 'emulator';
  setSelectionType: (type: 'account' | 'emulator') => void;
  accounts: SocialAccount[];
  loadingAccounts: boolean;
  selectedAccount: SocialAccount | null;
  setSelectedAccount: (account: SocialAccount | null) => void;
  binding: AccountEmulatorBinding | null;
  selectedEmulator: Emulator | null;
  setSelectedEmulator: (emulator: Emulator | null) => void;

  // Методи
  loadAccounts: () => Promise<void>;
  loadBinding: (accountId: string) => Promise<void>;
  createBinding: (accountId: string, emulatorId: string) => Promise<AccountEmulatorBinding>;
  resolveAccountAndEmulator: (values: any) => Promise<{ accountId?: string; emulatorId?: string }>;
}

export function useAccountEmulatorSelection({
  platform,
  loading = false,
}: UseAccountEmulatorSelectionProps): UseAccountEmulatorSelectionReturn {
  const { user } = useAuth();
  const [selectionType, setSelectionType] = useState<'account' | 'emulator'>('account');
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SocialAccount | null>(null);
  const [binding, setBinding] = useState<AccountEmulatorBinding | null>(null);
  const [selectedEmulator, setSelectedEmulator] = useState<Emulator | null>(null);

  // Завантаження акаунтів
  useEffect(() => {
    if (user && selectionType === 'account') {
      loadAccounts();
    }
  }, [user, selectionType, platform]);

  // Завантаження прив'язки при виборі акаунта
  useEffect(() => {
    if (selectedAccount) {
      loadBinding(selectedAccount.id);
    } else {
      setBinding(null);
    }
  }, [selectedAccount]);

  const loadAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const token = tokenStorage.get();
      if (!token) return;

      const backendClient = createBackendClient(token);
      const response = await backendClient.getSocialAccounts({
        platform,
        status: 'active',
      });
      
      // Не фільтруємо заблоковані - показуємо всі, але вони будуть disabled в селекті
      setAccounts(response.data || []);
    } catch (err: any) {
      console.error('Помилка завантаження акаунтів:', err);
      message.error('Не вдалося завантажити акаунти');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadBinding = async (accountId: string) => {
    try {
      const token = tokenStorage.get();
      if (!token) return;

      const backendClient = createBackendClient(token);
      const binding = await backendClient.getBindingForAccount(accountId);
      setBinding(binding);
    } catch (err: any) {
      console.error('Помилка завантаження прив\'язки:', err);
      setBinding(null);
    }
  };

  const createBinding = async (accountId: string, emulatorId: string) => {
    try {
      const token = tokenStorage.get();
      if (!token) throw new Error('Необхідна авторизація');

      const backendClient = createBackendClient(token);
      const newBinding = await backendClient.createBinding({
        account_id: accountId,
        emulator_id: emulatorId,
        binding_type: 'permanent',
      });
      setBinding(newBinding);
      message.success('Прив\'язку створено успішно!');
      return newBinding;
    } catch (err: any) {
      console.error('Помилка створення прив\'язки:', err);
      throw err;
    }
  };

  const resolveAccountAndEmulator = async (values: any): Promise<{ accountId?: string; emulatorId?: string }> => {
    let accountId: string | undefined;
    let emulatorId: string | undefined;

    if (selectionType === 'account') {
      // Якщо обрано акаунт
      if (!values.accountId) {
        throw new Error('Оберіть акаунт');
      }

      accountId = values.accountId;
      if (!accountId) {
        throw new Error('Оберіть акаунт');
      }
      
      const account = accounts.find(a => a.id === accountId);
      if (!account) {
        throw new Error('Акаунт не знайдено');
      }

      // Перевірка та створення прив'язки
      if (!binding) {
        if (!values.emulatorId) {
          throw new Error('Для нового акаунта оберіть емулятор для прив\'язки');
        }

        // Створюємо прив'язку (accountId гарантовано string після перевірки вище)
        await createBinding(accountId as string, values.emulatorId);
        emulatorId = values.emulatorId;
      } else {
        // Використовуємо емулятор з прив'язки
        emulatorId = binding.emulator_id;
      }
    } else {
      // Якщо обрано емулятор
      if (!values.emulatorId) {
        throw new Error('Оберіть емулятор');
      }
      emulatorId = values.emulatorId;
    }

    return { accountId, emulatorId };
  };

  return {
    selectionType,
    setSelectionType,
    accounts,
    loadingAccounts,
    selectedAccount,
    setSelectedAccount,
    binding,
    selectedEmulator,
    setSelectedEmulator,
    loadAccounts,
    loadBinding,
    createBinding,
    resolveAccountAndEmulator,
  };
}
