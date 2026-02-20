'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DialogBase from './DialogBase';
import { SortedSelect as AntdSelect } from '@/components/ui/SortedSelect';

import { useFormValidation } from '@/hooks/useFormValidation';
import { useLoadAuxiliaryData } from '@/hooks/useLoadAuxiliaryData';
import { receitaRecorrenteCreateSchema } from '@/lib/validation/schemas/receitaRecorrente';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { applyBackendErrors } from '@/lib/validation/backendErrors';
import { formatCurrencyInput, parseCurrencyBR } from '@/lib/formatters';

import ComissaoList, { ComissaoItem } from '@/components/dialogs/ComissaoList';

import {
  ReceitaRecorrente,
  ReceitaRecorrenteCreate,
  ReceitaRecorrenteUpdate,
} from '@/types/receitasRecorrentes';
import { Cliente } from '@/types/clientes';
import { getClientes } from '@/services/clientes';
import { getFuncionarios } from '@/services/funcionarios';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ReceitaRecorrenteCreate | ReceitaRecorrenteUpdate) => Promise<void>;
  receita?: ReceitaRecorrente | null;
}

export default function ReceitaRecorrenteDialog({
  open,
  onClose,
  onSubmit,
  receita,
}: Props) {
  const [valorDisplay, setValorDisplay] = useState('');
  const [comissoes, setComissoes] = useState<ComissaoItem[]>([]);

  const { data: clientes } = useLoadAuxiliaryData({
    loadFn: async () => (await getClientes({ page_size: 1000 })).results,
    onOpen: open,
    errorMessage: 'Erro ao carregar clientes',
    cacheData: false,
  });

  const { data: funcionarios } = useLoadAuxiliaryData({
    loadFn: async () => (await getFuncionarios({ page_size: 1000 })).results,
    onOpen: open,
    errorMessage: 'Erro ao carregar funcionários',
    cacheData: false,
  });

  const {
    formData,
    setFormData,
    setFieldError,
    isSubmitting,
    handleSubmit,
    getFieldProps,
  } = useFormValidation<ReceitaRecorrenteCreate>({
    nome: '',
    descricao: '',
    cliente_id: 0,
    valor: 0,
    tipo: 'F',
    forma_pagamento: null,
    data_inicio: '',
    dia_vencimento: 1,
  }, receitaRecorrenteCreateSchema);

  useEffect(() => {
    if (receita) {
      setFormData({
        nome: receita.nome,
        descricao: receita.descricao,
        cliente_id: receita.cliente?.id ?? receita.cliente_id,
        valor: receita.valor,
        tipo: receita.tipo,
        forma_pagamento: receita.forma_pagamento,
        data_inicio: receita.data_inicio,
        data_fim: receita.data_fim,
        dia_vencimento: receita.dia_vencimento,
        status: receita.status,
      });
      setComissoes(
        (receita.comissoes || []).map((c) => ({
          id: String(c.id ?? crypto.randomUUID()),
          funcionario_id: c.funcionario_id,
          percentual: c.percentual,
        }))
      );
      setValorDisplay(formatCurrencyInput(receita.valor));
    } else {
      setFormData({
        nome: '',
        descricao: '',
        cliente_id: 0,
        valor: 0,
        tipo: 'F',
        forma_pagamento: null,
        data_inicio: '',
        dia_vencimento: 1,
      });
      setComissoes([]);
      setValorDisplay('');
    }
  }, [receita, open, setFormData]);

  const handleSubmitWrapper = async () => {
    const comissoesPayload = comissoes
      .filter((c) => c.funcionario_id !== null && c.percentual !== '' && c.percentual !== 0)
      .map((c) => ({
        funcionario_id: c.funcionario_id as number,
        percentual: Number(c.percentual),
      }));

    await handleSubmit(async (data) => {
      try {
        await onSubmit({ ...data, comissoes: comissoesPayload });
        onClose();
      } catch (error) {
        const generalError = applyBackendErrors(setFieldError, error);
        if (generalError) toast.error(generalError);
        throw error;
      }
    });
  };

  return (
    <DialogBase open={open} onClose={onClose} title={receita ? 'Editar Receita Recorrente' : 'Nova Receita Recorrente'} onSubmit={handleSubmitWrapper} loading={isSubmitting}>
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Cliente <span className="text-red-500">*</span></label>
            <AntdSelect showSearch placeholder="Selecione um cliente" value={formData.cliente_id || undefined} options={clientes?.map((c: Cliente) => ({ value: c.id, label: c.nome })) || []} onChange={(val) => setFormData(prev => ({ ...prev, cliente_id: val ?? 0 }))} style={{ width: '100%' }} status={getFieldProps('cliente_id').error ? 'error' : undefined} />
            {getFieldProps('cliente_id').error && <p className="text-xs text-red-500 flex items-center gap-1"><span className="font-medium">⚠</span> {getFieldProps('cliente_id').error}</p>}
          </div>
          <FormInput label="Nome da Receita" required placeholder="Ex: Mensalidade Consultoria" value={formData.nome} onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))} error={getFieldProps('nome').error} />
        </div>
        <FormInput label="Descrição" placeholder="Detalhes sobre a receita recorrente" value={formData.descricao} onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))} error={getFieldProps('descricao').error} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput label="Valor (R$)" required placeholder="0,00" value={valorDisplay} onChange={(e) => setValorDisplay(e.target.value)} onBlur={() => { const parsed = parseCurrencyBR(valorDisplay); setValorDisplay(parsed ? formatCurrencyInput(parsed) : ''); setFormData(prev => ({ ...prev, valor: parsed })); }} error={getFieldProps('valor').error} />
          <FormSelect label="Tipo" required value={formData.tipo} onValueChange={(val) => setFormData(prev => ({ ...prev, tipo: val as 'F' | 'V' }))} options={[{ value: 'F', label: 'Fixa' }, { value: 'V', label: 'Variável' }]} error={getFieldProps('tipo').error} />
          <FormInput label="Dia de Vencimento" required type="number" min="1" max="31" placeholder="1-31" value={formData.dia_vencimento} onChange={(e) => setFormData(prev => ({ ...prev, dia_vencimento: parseInt(e.target.value) || 1 }))} error={getFieldProps('dia_vencimento').error} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormSelect label="Forma de Pagamento" value={formData.forma_pagamento || ''} onValueChange={(val) => setFormData(prev => ({ ...prev, forma_pagamento: val ? val as 'P' | 'B' : null }))} options={[{ value: 'P', label: 'Pix' }, { value: 'B', label: 'Boleto' }]} placeholder="Selecione..." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput label="Data de Início" required type="date" value={formData.data_inicio} onChange={(e) => setFormData(prev => ({ ...prev, data_inicio: e.target.value }))} error={getFieldProps('data_inicio').error} />
          <FormInput label="Data de Fim (Opcional)" type="date" value={formData.data_fim || ''} onChange={(e) => setFormData(prev => ({ ...prev, data_fim: e.target.value || null }))} />
          <FormSelect label="Status" value={formData.status || 'A'} onValueChange={(val) => setFormData(prev => ({ ...prev, status: val as 'A' | 'P' }))} options={[{ value: 'A', label: 'Ativa' }, { value: 'P', label: 'Pausada' }]} />
        </div>

        {/* Regras de comissão */}
        <ComissaoList
          comissoes={comissoes}
          setComissoes={setComissoes}
          funcionarios={funcionarios || []}
          emptyHint="Sem regras específicas — usará as regras do cliente"
        />
      </div>
    </DialogBase>
  );
}
