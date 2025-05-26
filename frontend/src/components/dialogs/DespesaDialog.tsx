'use client';

import { useEffect, useState } from 'react';
import DialogBase from '@/components/dialogs/DialogBase';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Despesa } from '@/services/despesas';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  despesa?: Despesa | null;
}

export default function DespesaDialog({
  open,
  onClose,
  onSubmit,
  despesa,
}: Props) {
  const [formData, setFormData] = useState<any>({
    nome: '',
    descricao: '',
    responsavel_id: '',
    valor: '',
    data_vencimento: '',
    tipo: '',
    situacao: 'A',
    data_pagamento: '',
    valor_pago: '',
  });

  const [situacao, setSituacao] = useState<'A' | 'P' | 'V'>('A');

  useEffect(() => {
    if (despesa) {
      setFormData({
        nome: despesa.nome || '',
        descricao: despesa.descricao || '',
        responsavel_id: String(despesa.responsavel?.id || ''),
        valor: despesa.valor || '',
        data_vencimento: despesa.data_vencimento || '',
        tipo: despesa.tipo || '',
        situacao: despesa.situacao || 'A',
        data_pagamento: despesa.data_pagamento || '',
        valor_pago: despesa.valor_pago || '',
      });
      setSituacao((despesa.situacao as 'A' | 'P' | 'V') || 'A');
    } else {
      setFormData({
        nome: '',
        descricao: '',
        responsavel_id: '',
        valor: '',
        data_vencimento: '',
        tipo: '',
        situacao: 'A',
        data_pagamento: '',
        valor_pago: '',
      });
      setSituacao('A');
    }
  }, [despesa, open]);

  const handleSubmit = () => {
    const payload = {
      ...formData,
      data_pagamento: situacao === 'P' ? formData.data_pagamento : null,
      valor_pago: situacao === 'P' ? formData.valor_pago : null,
      situacao: situacao,
    };
    onSubmit(payload);
    onClose();
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={despesa ? 'Editar Despesa' : 'Nova Despesa'}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* 🔹 Favorecido + Nome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Favorecido (ID)</label>
            <Input
              placeholder="ID do Fornecedor"
              value={formData.responsavel_id}
              onChange={(e) =>
                setFormData({ ...formData, responsavel_id: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-sm">Nome</label>
            <Input
              placeholder="Nome da Despesa"
              value={formData.nome}
              onChange={(e) =>
                setFormData({ ...formData, nome: e.target.value })
              }
            />
          </div>
        </div>

        {/* 🔸 Descrição */}
        <div>
          <label className="text-sm">Descrição</label>
          <Input
            placeholder="Observações ou descrição"
            value={formData.descricao}
            onChange={(e) =>
              setFormData({ ...formData, descricao: e.target.value })
            }
          />
        </div>

        {/* 🔸 Valor, Vencimento e Tipo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm">Valor (R$)</label>
            <Input
              type="number"
              placeholder="Ex.: 1500"
              value={formData.valor}
              onChange={(e) =>
                setFormData({ ...formData, valor: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm">Data de Vencimento</label>
            <Input
              type="date"
              value={formData.data_vencimento}
              onChange={(e) =>
                setFormData({ ...formData, data_vencimento: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm">Tipo</label>
            <Select
              value={formData.tipo}
              onValueChange={(val) => setFormData({ ...formData, tipo: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Fixa</SelectItem>
                <SelectItem value="V">Variável</SelectItem>
                <SelectItem value="C">Comissão</SelectItem>
                <SelectItem value="R">Reembolso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 🔸 Situação */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Situação</label>
            <Select
              value={situacao}
              onValueChange={(val) => setSituacao(val as 'A' | 'P' | 'V')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Em Aberto</SelectItem>
                <SelectItem value="P">Pago</SelectItem>
                <SelectItem value="V">Vencida</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 🔥 Se Pago */}
        {situacao === 'P' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm">Data de Pagamento</label>
              <Input
                type="date"
                value={formData.data_pagamento}
                onChange={(e) =>
                  setFormData({ ...formData, data_pagamento: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-sm">Valor Pago (R$)</label>
              <Input
                type="number"
                placeholder="Ex.: 1500"
                value={formData.valor_pago}
                onChange={(e) =>
                  setFormData({ ...formData, valor_pago: e.target.value })
                }
              />
            </div>
          </div>
        )}
      </div>
    </DialogBase>
  );
}
