'use client';

import { Select } from 'antd';
import { useCountries } from '@/hooks/useCountries';

const { Option } = Select;

interface CountrySelectProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  loading?: boolean;
}

export function CountrySelect({
  value,
  onChange,
  placeholder = 'Select country',
  allowClear = true,
  disabled = false,
  style,
  loading: externalLoading,
}: CountrySelectProps) {
  const { countries, loading } = useCountries();
  const isLoading = externalLoading ?? loading;

  return (
    <Select
      value={value || undefined}
      onChange={(v) => onChange?.(v ?? null)}
      placeholder={placeholder}
      allowClear={allowClear}
      disabled={disabled || isLoading}
      loading={isLoading}
      showSearch
      optionFilterProp="children"
      filterOption={(input, option) =>
        String(option?.label ?? option?.children ?? '').toLowerCase().includes(input.toLowerCase())
      }
      style={style}
    >
      {countries.map((c) => (
        <Option key={c.code} value={c.code}>
          {c.name}
        </Option>
      ))}
    </Select>
  );
}
