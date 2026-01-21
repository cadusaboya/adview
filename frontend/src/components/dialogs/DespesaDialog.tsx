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


import { Select as AntdSelect } from 'antd';

import {
  formatCurrencyInput,
  parseCurrencyBR,
} from '@/lib/formatters';

import PaymentsTabs from '@/components/imports/PaymentsTabs';
import { getBancos } from '@/services/bancos';
import { getFavorecidos, Favorecido } from '@/services/favorecidos';
import { Despesa } from '@/services/despesas';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Despesa) => Promise<void>;
  despesa?: Despesa | null;
}

export default function DespesaDialog({
  open,
  onClose,
  onSubmit,
  despesa,
}: Props) {
  const [formData, setFormData] = useState<Despesa>({
    nome: '',
    descricao: '',
    responsavel_id: '',
    valor: '',
    data_vencimento: '',
    tipo: '',
  });

  const [valorDisplay, setValorDisplay] = useState('');
  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
  const [favorecidos, setFavorecidos] = useState<Favorecido[]>([]);

  /* 🔹 Preencher formulário ao editar */
  useEffect(() => {
    if (despesa) {
      setFormData({
        nome: despesa.nome || '',
        descricao: despesa.descricao || '',
        responsavel_id: despesa.responsavel?.id
          ? String(despesa.responsavel.id)
          : '',
        valor: despesa.valor || '',
        data_vencimento: despesa.data_vencimento || '',
        tipo: despesa.tipo || '',
      });

      setValorDisplay(
        despesa.valor ? formatCurrencyInput(despesa.valor) : ''
      );
    } else {
      setFormData({
        nome: '',
        descricao: '',
        responsavel_id: '',
        valor: '',
        data_vencimento: '',
        tipo: '',
      });
      setValorDisplay('');
    }
  }, [despesa, open]);

  /* 🔹 Carregar bancos */
  useEffect(() => {
    const loadBancos = async () => {
      const { results } = await getBancos({ page_size: 1000 });
      setBancos(results.map((b) => ({ id: b.id, nome: b.nome })));
    };
    loadBancos();
  }, []);

  /* 🔹 Carregar favorecidos */
  useEffect(() => {
    const loadFavorecidos = async () => {
      try {
        const { results } = await getFavorecidos({ page_size: 1000 });
        setFavorecidos(results);
      } catch (error) {
        console.error('Erro ao carregar favorecidos', error);
      }
    };
    loadFavorecidos();
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
        {/* 🔹 Favorecido + Nome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Favorecido</label>

            <AntdSelect
              showSearch
              allowClear
              placeholder="Selecione um favorecido"
              value={formData.responsavel_id || undefined}
              style={{ width: '100%' }}
              listHeight={256}
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={favorecidos.map((f) => ({
                value: String(f.id),
                label: f.nome,
              }))}
              onChange={(val) =>
                setFormData({
                  ...formData,
                  responsavel_id: val || '',
                })
              }
              // 🔥 FIX: Adicionar popupClassName para corrigir z-index
              popupClassName="antd-select-popup-dialog"
              // 🔥 FIX: Usar getPopupContainer para renderizar dentro do dialog
              getPopupContainer={(trigger) => {
                // Procura pelo dialog mais próximo
                const dialogParent = trigger.closest('[role="dialog"]');
                return dialogParent || document.body;
              }}
            />
          </div>

          <div>
            <label className="text-sm">Nome</label>
            <Input
              placeholder="Nome da despesa"
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
            placeholder="Descrição ou observações"
            value={formData.descricao}
            onChange={(e) =>
              setFormData({ ...formData, descricao: e.target.value })
            }
          />
        </div>

        {/* 🔸 Valor + Vencimento + Tipo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm">Valor (R$)</label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valorDisplay}
              onChange={(e) => setValorDisplay(e.target.value)}
              onFocus={() => {
                setValorDisplay(valorDisplay.replace(/[^\d,]/g, ''));
              }}
              onBlur={() => {
                const parsed = parseCurrencyBR(valorDisplay);
                setValorDisplay(
                  parsed ? formatCurrencyInput(parsed) : ''
                );
                setFormData((prev: Despesa) => ({
                  ...prev,
                  valor: parsed,
                }));
              }}
            />
          </div>

          <div>
            <label className="text-sm">Data de Vencimento</label>
            <Input
              type="date"
              value={formData.data_vencimento}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  data_vencimento: e.target.value,
                })
              }
            />
          </div>

          <div>
            <label className="text-sm">Tipo</label>
            <Select
              value={formData.tipo}
              onValueChange={(val) =>
                setFormData({ ...formData, tipo: val })
              }
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

      {/* 🔥 CSS para corrigir z-index do Ant Design Select dentro do Dialog */}
      <style jsx global>{`
        .antd-select-popup-dialog {
          z-index: 9999 !important;
        }
        
        /* Garantir que o dropdown do Ant Design fique acima do dialog */
        .ant-select-dropdown {
          z-index: 9999 !important;
        }
      `}</style>
    </DialogBase>
  );
}
