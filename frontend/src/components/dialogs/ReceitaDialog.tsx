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
import PaymentsTabs from '@/components/imports/PaymentsTabs';
import { getBancos } from '@/services/bancos';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<any>; // Criação ou edição da receita
  receita?: any | null;
}

export default function ReceitaDialog({
  open,
  onClose,
  onSubmit,
  receita,
}: Props) {
  const [formData, setFormData] = useState<any>({
    nome: '',
    descricao: '',
    cliente_id: '',
    valor: '',
    data_vencimento: '',
    tipo: '',
    forma_pagamento: '',
    comissionado_id: '',
  });

  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);

  useEffect(() => {
    if (receita) {
      setFormData({
        nome: receita.nome || '',
        descricao: receita.descricao || '',
        cliente_id: String(receita.cliente_id) || '',
        valor: receita.valor || '',
        data_vencimento: receita.data_vencimento || '',
        tipo: receita.tipo || '',
        forma_pagamento: receita.forma_pagamento || '',
        comissionado_id: receita.comissionado_id ? String(receita.comissionado_id) : '',
      });
    } else {
      setFormData({
        nome: '',
        descricao: '',
        cliente_id: '',
        valor: '',
        data_vencimento: '',
        tipo: '',
        forma_pagamento: '',
        comissionado_id: '',
      });
    }
  }, [receita, open]);

  useEffect(() => {
    const loadBancos = async () => {
      const data = await getBancos();
      setBancos(data.map((banco) => ({ id: banco.id, nome: banco.nome })));
    };
    loadBancos();
  }, []);

  const handleSubmit = async () => {
    const payload = { ...formData };
    await onSubmit(payload);
    onClose();
  };

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      title={receita ? 'Editar Receita' : 'Nova Receita'}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* 🔹 Cliente + Nome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Cliente (ID)</label>
            <Input
              placeholder="ID do Cliente"
              value={formData.cliente_id}
              onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm">Nome</label>
            <Input
              placeholder="Nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            />
          </div>
        </div>

        {/* 🔸 Descrição */}
        <div>
          <label className="text-sm">Descrição</label>
          <Input
            placeholder="Observações ou descrição"
            value={formData.descricao}
            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          />
        </div>

        {/* 🔸 Valor + Vencimento + Tipo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm">Valor (R$)</label>
            <Input
              type="number"
              placeholder="Ex.: 1500"
              value={formData.valor}
              onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm">Data de Vencimento</label>
            <Input
              type="date"
              value={formData.data_vencimento}
              onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
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
                <SelectItem value="E">Estorno</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 🔸 Forma Pgto + Comissionado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Forma de Pagamento</label>
            <Select
              value={formData.forma_pagamento}
              onValueChange={(val) => setFormData({ ...formData, forma_pagamento: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="P">Pix</SelectItem>
                <SelectItem value="B">Boleto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm">Comissionado (ID) - Opcional</label>
            <Input
              placeholder="ID do Comissionado"
              value={formData.comissionado_id}
              onChange={(e) => setFormData({ ...formData, comissionado_id: e.target.value })}
            />
          </div>
        </div>

        {/* 🔥 Pagamentos */}
        {receita && (
          <PaymentsTabs
            tipo="receita"
            entityId={receita.id}
            contasBancarias={bancos}
          />
        )}
      </div>
    </DialogBase>
  );
}
