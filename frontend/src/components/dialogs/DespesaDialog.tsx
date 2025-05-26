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
import { Despesa } from '@/services/despesas';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<any>;
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
  });

  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (despesa) {
        setFormData({
          nome: despesa.nome || '',
          descricao: despesa.descricao || '',
          responsavel_id: String(despesa.responsavel?.id || ''),
          valor: despesa.valor || '',
          data_vencimento: despesa.data_vencimento || '',
          tipo: despesa.tipo || '',
        });
      } else {
        setFormData({
          nome: '',
          descricao: '',
          responsavel_id: '',
          valor: '',
          data_vencimento: '',
          tipo: '',
        });
      }
    };

    loadData();
  }, [despesa, open]);

  useEffect(() => {
    const loadBancos = async () => {
      const { results } = await getBancos({ page_size: 1000 }); // Pegando todos os bancos
      setBancos(results.map((banco) => ({ id: banco.id, nome: banco.nome })));
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
      title={despesa ? 'Editar Despesa' : 'Nova Despesa'}
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* 🔹 Responsável + Nome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Favorecido (ID)</label>
            <Input
              placeholder="ID do fornecedor"
              value={formData.responsavel_id}
              onChange={(e) => setFormData({ ...formData, responsavel_id: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm">Nome</label>
            <Input
              placeholder="Nome da despesa"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            />
          </div>
        </div>

        {/* 🔸 Descrição */}
        <div>
          <label className="text-sm">Descrição</label>
          <Input
            placeholder="Descrição ou observações"
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
                <SelectItem value="C">Comissão</SelectItem>
                <SelectItem value="R">Reembolso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 🔥 Pagamentos */}
        {despesa && (
          <PaymentsTabs
            tipo="despesa"
            entityId={despesa.id}
            contasBancarias={bancos}
          />
        )}
      </div>
    </DialogBase>
  );
}
