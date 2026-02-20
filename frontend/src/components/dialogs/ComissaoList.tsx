'use client';

import { SortedSelect as AntdSelect } from '@/components/ui/SortedSelect';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { Funcionario } from '@/types/funcionarios';

export interface ComissaoItem {
  id: string; // local UUID para gerenciar a lista
  funcionario_id: number | null;
  percentual: number | string;
}

interface Props {
  comissoes: ComissaoItem[];
  setComissoes: (items: ComissaoItem[]) => void;
  funcionarios: Funcionario[];
  emptyHint?: string; // texto exibido quando a lista está vazia
}

export default function ComissaoList({ comissoes, setComissoes, funcionarios, emptyHint }: Props) {
  const handleAdd = () => {
    setComissoes([
      ...comissoes,
      { id: crypto.randomUUID(), funcionario_id: null, percentual: '' },
    ]);
  };

  const handleRemove = (id: string) => {
    setComissoes(comissoes.filter((c) => c.id !== id));
  };

  const update = (id: string, data: Partial<ComissaoItem>) => {
    setComissoes(comissoes.map((c) => (c.id === id ? { ...c, ...data } : c)));
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-700">Regras de Comissão</h3>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          + Adicionar
        </Button>
      </div>

      {comissoes.length === 0 && emptyHint && (
        <p className="text-xs text-muted-foreground italic">{emptyHint}</p>
      )}

      {comissoes.map((item) => (
        <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start border rounded-md p-3 bg-muted">
          {/* Funcionário */}
          <div className="md:col-span-7 space-y-1">
            <label className="text-xs font-medium">Comissionado</label>
            <AntdSelect
              showSearch
              allowClear
              placeholder="Selecione um funcionário/parceiro"
              value={item.funcionario_id ?? undefined}
              options={funcionarios.map((f) => ({
                value: f.id,
                label: `${f.nome} (${f.tipo === 'F' ? 'Funcionário' : 'Parceiro'})`,
              }))}
              onChange={(val) => update(item.id, { funcionario_id: val ?? null })}
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%' }}
            />
          </div>

          {/* Percentual */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-medium">% Comissão</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="Ex: 15"
              value={item.percentual}
              onChange={(e) => update(item.id, { percentual: e.target.value })}
            />
          </div>

          {/* Remover */}
          <div className="md:col-span-1 flex justify-end mt-5">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => handleRemove(item.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
