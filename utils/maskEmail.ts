/**
 * Маскує email адресу, залишаючи видимими перші 2 символи перед @ та домен
 * Приклад: example@mail.com -> ex***@mail.com
 * Приклад: ab@test.com -> ab***@test.com
 * Приклад: a@test.com -> a***@test.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) {
    return '-';
  }

  const [localPart, domain] = email.split('@');
  
  if (!domain) {
    // Якщо немає @, повертаємо оригінальний рядок
    return email;
  }

  if (localPart.length <= 2) {
    // Якщо локальна частина коротка (1-2 символи), показуємо її повністю
    return `${localPart}***@${domain}`;
  }

  // Показуємо перші 2 символи та маскуємо решту
  const visiblePart = localPart.substring(0, 2);
  return `${visiblePart}***@${domain}`;
}

