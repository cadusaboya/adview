'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { SortedSelect as AntdSelect } from '@/components/ui/SortedSelect';

export interface CreateTypeOption {
  value: string;
  label: string;
}

export interface SelectWithCreateProps {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: number | undefined;
  onChange: (val: number | undefined) => void;
  options: { value: number; label: string }[];
  error?: string;
  style?: React.CSSProperties;
  createTypes: CreateTypeOption[];
  defaultCreateType: string;
  entityLabel: string;
  onCreate: (nome: string, tipo: string) => Promise<{ id: number; nome: string }>;
}

export function SelectWithCreate({
  label,
  required,
  placeholder,
  value,
  onChange,
  options,
  error,
  style,
  createTypes,
  defaultCreateType,
  entityLabel,
  onCreate,
}: SelectWithCreateProps) {
  const [searchValue, setSearchValue] = useState('');
  const [selectedType, setSelectedType] = useState(defaultCreateType);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const nome = searchValue.trim();
    if (!nome) return;
    setCreating(true);
    try {
      const novo = await onCreate(nome, selectedType);
      onChange(novo.id);
      setSearchValue('');
      toast.success(`${entityLabel} "${novo.nome}" criado com sucesso`);
    } catch {
      toast.error(`Erro ao criar ${entityLabel.toLowerCase()}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <AntdSelect
        showSearch
        placeholder={placeholder}
        value={value}
        options={options}
        onChange={onChange}
        onSearch={setSearchValue}
        searchValue={searchValue}
        filterOption={(input, option) =>
          String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
        }
        style={style}
        status={error ? 'error' : undefined}
        dropdownRender={(menu) => (
          <>
            {menu}
            {searchValue.trim() && (
              <div className="border-t px-3 py-2 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Criar <strong>&quot;{searchValue.trim()}&quot;</strong> como:
                </p>
                <div className="flex gap-2 items-center flex-wrap">
                  {createTypes.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setSelectedType(t.value)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        selectedType === t.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-input hover:bg-muted'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={creating}
                    onClick={handleCreate}
                    className="ml-auto text-xs px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {creating ? 'Criando...' : '+ Criar'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      />
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <span className="font-medium">⚠</span> {error}
        </p>
      )}
    </div>
  );
}
