'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DialogBase from './DialogBase';
import { Select as AntdSelect } from 'antd';

import { useFormValidation } from '@/hooks/useFormValidation';
import { useLoadAuxiliaryData } from '@/hooks/useLoadAuxiliaryData';
import { despesaRecorrenteCreateSchema } from '@/lib/validation/schemas/despesaRecorrente';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { applyBackendErrors } from '@/lib/validation/backendErrors';
import { formatCurrencyInput, parseCurrencyBR } from '@/lib/formatters';

import {
  DespesaRecorrente,
  DespesaRecorrenteCreate,
  DespesaRecorrenteUpdate,
} from '@/types/despesasRecorrentes';
import { Favorecido } from '@/types/favorecidos';
import { getFavorecidos } from '@/services/favorecidos';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: DespesaRecorrenteCreate | DespesaRecorrenteUpdate) => Promise<void>;
  despesa?: DespesaRecorrente | null;
}

export default function DespesaRecorrenteDialog({
  open,
  onClose,
  onSubmit,
  despesa,
}: Props) {
  const [valorDisplay, setValorDisplay] = useState('');

  const { data: favorecidos } = useLoadAuxiliaryData({
    loadFn: async () => (await getFavorecidos({ page_size: 1000 })).results,
    onOpen: open,
    errorMessage: 'Erro ao carregar favorecidos',
  });

  const {
    formData,
    setFormData,
    setFieldError,
    isSubmitting,
    handleSubmit,
    getFieldProps,
  } = useFormValidation<DespesaRecorrenteCreate>({
    nome: '',
    descricao: '',
    responsavel_id: 0,
    valor: 0,
    tipo: 'F',
    forma_pagamento: null,
    data_inicio: '',
    dia_vencimento: 1,
  }, despesaRecorrenteCreateSchema);

  useEffect(() => {
    if (despesa) {
      setFormData({
        nome: despesa.nome,
        descricao: despesa.descricao,
        responsavel_id: despesa.responsavel?.id ?? despesa.responsavel_id,
        valor: despesa.valor,
        tipo: despesa.tipo,
        forma_pagamento: despesa.forma_pagamento,
        data_inicio: despesa.data_inicio,
        data_fim: despesa.data_fim,
        dia_vencimento: despesa.dia_vencimento,
        status: despesa.status,
      });
      setValorDisplay(formatCurrencyInput(despesa.valor));
    } else {
      setFormData({
        nome: '',
        descricao: '',
        responsavel_id: 0,
        valor: 0,
        tipo: 'F',
        forma_pagamento: null,
        data_inicio: '',
        dia_vencimento: 1,
      });
      setValorDisplay('');
    }
  }, [despesa, open, setFormData]);

  const handleSubmitWrapper = async () => {
    await handleSubmit(async (data) => {
      try {
        await onSubmit(data);
        onClose();
      } catch (error) {
        const generalError = applyBackendErrors(setFieldError, error);
        if (generalError) toast.error(generalError);
        throw error;
      }
    });
  };

  return (
    <DialogBase open={open} onClose={onClose} title={despesa ? 'Editar Despesa Recorrente' : 'Nova Despesa Recorrente'} onSubmit={handleSubmitWrapper} loading={isSubmitting}>
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Favorecido <span className="text-red-500">*</span></label>
            <AntdSelect showSearch placeholder="Selecione um favorecido" value={formData.responsavel_id || undefined} options={favorecidos?.map((f: Favorecido) => ({ value: f.id, label: f.nome })) || []} onChange={(val) => setFormData(prev => ({ ...prev, responsavel_id: val ?? 0 }))} style={{ width: '100%' }} status={getFieldProps('responsavel_id').error ? 'error' : undefined} filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
            {getFieldProps('responsavel_id').error && <p className="text-xs text-red-500 flex items-center gap-1"><span className="font-medium">⚠</span> {getFieldProps('responsavel_id').error}</p>}
          </div>
          <FormInput label="Nome da Despesa" required placeholder="Ex: Aluguel Escritório" value={formData.nome} onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))} error={getFieldProps('nome').error} />
        </div>
        <FormInput label="Descrição" required placeholder="Detalhes sobre a despesa recorrente" value={formData.descricao} onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))} error={getFieldProps('descricao').error} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput label="Valor (R$)" required placeholder="0,00" value={valorDisplay} onChange={(e) => setValorDisplay(e.target.value)} onBlur={() => { const parsed = parseCurrencyBR(valorDisplay); setValorDisplay(parsed ? formatCurrencyInput(parsed) : ''); setFormData(prev => ({ ...prev, valor: parsed })); }} error={getFieldProps('valor').error} />
          <FormSelect label="Tipo" required value={formData.tipo} onValueChange={(val) => setFormData(prev => ({ ...prev, tipo: val as 'F' | 'V' }))} options={[{ value: 'F', label: 'Fixa' }, { value: 'V', label: 'Variável' }]} error={getFieldProps('tipo').error} />
          <FormInput label="Dia de Vencimento" required type="number" min="1" max="31" placeholder="1-31" value={formData.dia_vencimento} onChange={(e) => setFormData(prev => ({ ...prev, dia_vencimento: parseInt(e.target.value) || 1 }))} error={getFieldProps('dia_vencimento').error} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormSelect label="Forma de Pagamento" value={formData.forma_pagamento || ''} onValueChange={(val) => setFormData(prev => ({ ...prev, forma_pagamento: val ? val as 'P' | 'B' : null }))} options={[{ value: 'P', label: 'Pix' }, { value: 'B', label: 'Boleto' }]} placeholder="Selecione..." />
          <FormInput label="Data de Início" required type="date" value={formData.data_inicio} onChange={(e) => setFormData(prev => ({ ...prev, data_inicio: e.target.value }))} error={getFieldProps('data_inicio').error} />
          <FormInput label="Data de Fim (Opcional)" type="date" value={formData.data_fim || ''} onChange={(e) => setFormData(prev => ({ ...prev, data_fim: e.target.value || null }))} />
        </div>
        <FormSelect label="Status" value={formData.status || 'A'} onValueChange={(val) => setFormData(prev => ({ ...prev, status: val as 'A' | 'P' }))} options={[{ value: 'A', label: 'Ativa' }, { value: 'P', label: 'Pausada' }]} />
      </div>
    </DialogBase>
  );
}
