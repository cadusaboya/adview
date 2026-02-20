'use client';

import { Select } from 'antd';
import type { SelectProps } from 'antd';

function sortOptions(options: SelectProps['options']): SelectProps['options'] {
  if (!options) return options;
  return [...options].sort((a, b) =>
    String(a?.label ?? '').localeCompare(String(b?.label ?? ''), 'pt-BR', { sensitivity: 'base' })
  );
}

export function SortedSelect(props: SelectProps) {
  return <Select {...props} options={sortOptions(props.options)} />;
}
