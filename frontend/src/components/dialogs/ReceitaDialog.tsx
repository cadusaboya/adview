'use client';

import { useEffect, useState } from 'react';
import DialogBase from '@/components/dialogs/DialogBase';
import { Checkbox } from '@/components/ui/checkbox';
import { Select as AntdSelect } from 'antd';
import { toast } from 'sonner';


import { useFormValidation } from '@/hooks/useFormValidation';
import { useLoadAuxiliaryData } from '@/hooks/useLoadAuxiliaryData';
import { useFormDirty } from '@/hooks/useFormDirty';
import { receitaCreateSchema } from '@/lib/validation/schemas/receita';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { applyBackendErrors } from '@/lib/validation/backendErrors';
import { formatCurrencyInput, parseCurrencyBR } from '@/lib/formatters';

import PaymentsTabs from '@/components/imports/PaymentsTabs';
import ComissaoList, { ComissaoItem } from '@/components/dialogs/ComissaoList';

import { getBancos } from '@/services/bancos';
import { getClientes } from '@/services/clientes';
import { getFuncionarios } from '@/services/funcionarios';

import { Cliente } from '@/types/clientes';
import {
  Receita,
  ReceitaCreate,
  ReceitaUpdate,
} from '@/types/receitas';
import { PaymentUI } from '@/types/payments';

// Extended interface for creating receita with payment
interface ReceitaCreateWithPayment extends ReceitaCreate {
  marcar_como_pago?: boolean;
  data_pagamento?: string;
  conta_bancaria_id?: number;
  observacao_pagamento?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ReceitaCreate | ReceitaUpdate) => Promise<void>;
  receita?: Receita | null;
  initialBancos?: { id: number; nome: string }[];
  initialClientes?: Cliente[];
  initialPayments?: PaymentUI[];
}

export default function ReceitaDialog({
  open,
  onClose,
  onSubmit,
  receita,
  initialBancos,
  initialClientes,
  initialPayments,
}: Props) {
  // Load auxiliary data in parallel (or use initial data if provided)
  const { data: bancosFromHook, loading: loadingBancos } = useLoadAuxiliaryData({
    loadFn: async () => {
      const res = await getBancos({ page_size: 1000 });
      return res.results.map((b) => ({ id: b.id, nome: b.nome }));
    },
    onOpen: open && !initialBancos, // Only load if not provided
    errorMessage: 'Erro ao carregar bancos',
  });

  const { data: clientesFromHook, loading: loadingClientes } = useLoadAuxiliaryData({
    loadFn: async () => {
      const res = await getClientes({ page_size: 1000 });
      return res.results;
    },
    onOpen: open && !initialClientes, // Only load if not provided
    errorMessage: 'Erro ao carregar clientes',
  });

  const { data: funcionarios } = useLoadAuxiliaryData({
    loadFn: async () => {
      const res = await getFuncionarios({ page_size: 1000 });
      return res.results;
    },
    onOpen: open,
    errorMessage: 'Erro ao carregar funcionários',
  });

  // Use initial data if provided, otherwise use hook data
  const bancos = initialBancos || bancosFromHook;
  const clientes = initialClientes || clientesFromHook;

  // Check if auxiliary data is still loading (only when editing)
  // Considera tanto o estado de loading quanto a disponibilidade dos dados
  const isLoadingAuxData = receita && (
    (!initialBancos && loadingBancos) ||
    (!initialClientes && loadingClientes) ||
    !bancos ||
    !clientes
  );

  // Form validation
  const {
    formData,
    setFormData,
    setFieldError,
    isSubmitting,
    handleSubmit,
    getFieldProps,
  } = useFormValidation<ReceitaCreate>(
    {
      nome: '',
      descricao: '',
      cliente_id: 0,
      valor: 0,
      data_vencimento: '',
      tipo: 'F',
      forma_pagamento: 'P',
    },
    receitaCreateSchema
  );

  // Regras de comissão específicas da receita
  const [comissoes, setComissoes] = useState<ComissaoItem[]>([]);

  // Payment fields state (only for creation)
  const [marcarComoPago, setMarcarComoPago] = useState(false);
  const [dataPagamento, setDataPagamento] = useState('');
  const [contaBancariaId, setContaBancariaId] = useState<number | undefined>();
  const [observacaoPagamento, setObservacaoPagamento] = useState('');

  // Valor display state
  const [valorDisplay, setValorDisplay] = useState('');

  // Initial form data for dirty checking
  const initialFormData: ReceitaCreate = {
    nome: '',
    descricao: '',
    cliente_id: 0,
    valor: 0,
    data_vencimento: '',
    tipo: 'F',
    forma_pagamento: 'P',
  };

  // Track if form has unsaved changes
  const isDirty = useFormDirty(formData, receita ? {
    nome: receita.nome,
    descricao: receita.descricao,
    cliente_id: receita.cliente?.id ?? receita.cliente_id ?? 0,
    valor: receita.valor,
    data_vencimento: receita.data_vencimento,
    tipo: receita.tipo,
    forma_pagamento: receita.forma_pagamento ?? 'P',
  } : initialFormData);

  // Handle close with confirmation
  const handleClose = () => {
    if (isDirty && !isSubmitting) {
      if (!confirm('Descartar alterações não salvas?')) {
        return;
      }
    }
    onClose();
  };

  // Initialize form when editing
  useEffect(() => {
    if (receita) {
      setFormData({
        nome: receita.nome,
        descricao: receita.descricao,
        cliente_id: receita.cliente?.id ?? receita.cliente_id ?? 0,
        valor: receita.valor,
        data_vencimento: receita.data_vencimento,
        tipo: receita.tipo,
        forma_pagamento: receita.forma_pagamento ?? 'P',
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
        data_vencimento: '',
        tipo: 'F',
        forma_pagamento: 'P',
      });
      setComissoes([]);
      setValorDisplay('');
      setMarcarComoPago(false);
      setDataPagamento('');
      setContaBancariaId(undefined);
      setObservacaoPagamento('');
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
        let payload: ReceitaUpdate | ReceitaCreate | ReceitaCreateWithPayment;

        if (receita) {
          payload = { ...data, comissoes: comissoesPayload } as ReceitaUpdate;
        } else {
          payload = { ...data, comissoes: comissoesPayload } as ReceitaCreate;

          // Add payment data if checkbox is checked
          if (marcarComoPago) {
            const paymentPayload = payload as ReceitaCreateWithPayment;
            paymentPayload.marcar_como_pago = true;
            paymentPayload.data_pagamento = dataPagamento;
            paymentPayload.conta_bancaria_id = contaBancariaId;
            paymentPayload.observacao_pagamento = observacaoPagamento;
            payload = paymentPayload;
          }
        }

        await onSubmit(payload);
        onClose();
      } catch (error) {
        const generalError = applyBackendErrors(setFieldError, error);
        if (generalError) {
          toast.error(generalError);
        }
        throw error;
      }
    });
  };

  return (
    <DialogBase
      open={open}
      onClose={handleClose}
      title={receita ? 'Editar Receita' : 'Nova Receita'}
      onSubmit={handleSubmitWrapper}
      loading={isSubmitting}
      size="lg"
      maxHeight="max-h-[90vh]"
      compact
    >
      {isLoadingAuxData ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
        {/* Cliente + Nome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Cliente <span className="text-red-500">*</span>
            </label>
            <AntdSelect
              showSearch
              placeholder="Selecione um cliente"
              value={formData.cliente_id || undefined}
              options={clientes?.map((c: Cliente) => ({
                value: c.id,
                label: c.nome,
              })) || []}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, cliente_id: val }))
              }
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%' }}
              status={getFieldProps('cliente_id').error ? 'error' : undefined}
            />
            {getFieldProps('cliente_id').error && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <span className="font-medium">⚠</span> {getFieldProps('cliente_id').error}
              </p>
            )}
          </div>

          <FormInput
            label="Nome"
            required
            placeholder="Nome da receita"
            value={formData.nome}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, nome: e.target.value }))
            }
            error={getFieldProps('nome').error}
          />
        </div>

        {/* Valor / Data / Tipo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            label="Valor (R$)"
            required
            placeholder="0,00"
            value={valorDisplay}
            onChange={(e) => setValorDisplay(e.target.value)}
            onBlur={() => {
              const parsed = parseCurrencyBR(valorDisplay);
              setValorDisplay(parsed ? formatCurrencyInput(parsed) : '');
              setFormData((prev) => ({ ...prev, valor: parsed }));
            }}
            error={getFieldProps('valor').error}
          />

          <FormInput
            label="Data de Vencimento"
            required
            type="date"
            value={formData.data_vencimento}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                data_vencimento: e.target.value,
              }))
            }
            error={getFieldProps('data_vencimento').error}
          />

          <FormSelect
            label="Tipo"
            required
            value={formData.tipo}
            onValueChange={(val) =>
              setFormData((prev) => ({ ...prev, tipo: val as ReceitaCreate['tipo'] }))
            }
            options={[
              { value: 'F', label: 'Fixa' },
              { value: 'V', label: 'Variável' },
              { value: 'E', label: 'Estorno' },
            ]}
            error={getFieldProps('tipo').error}
          />
        </div>

        {/* Forma de Pagamento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormSelect
            label="Forma de Pagamento"
            value={formData.forma_pagamento || ''}
            onValueChange={(val) =>
              setFormData((prev) => ({
                ...prev,
                forma_pagamento: val as ReceitaCreate['forma_pagamento'],
              }))
            }
            options={[
              { value: 'P', label: 'Pix' },
              { value: 'B', label: 'Boleto' },
            ]}
            error={getFieldProps('forma_pagamento').error}
          />
        </div>

        {/* Regras de comissão */}
        <ComissaoList
          comissoes={comissoes}
          setComissoes={setComissoes}
          funcionarios={funcionarios || []}
          emptyHint="Sem regras específicas — usará as regras do cliente"
        />

        {/* Marcar como pago - only when creating */}
        {!receita && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="marcar-pago"
                checked={marcarComoPago}
                onCheckedChange={(checked) =>
                  setMarcarComoPago(checked === true)
                }
              />
              <label
                htmlFor="marcar-pago"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Marcar como pago
              </label>
            </div>

            {marcarComoPago && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
                <FormInput
                  label="Data Pagamento"
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                />

                <div className="space-y-1">
                  <label className="text-sm font-medium">Conta Bancária</label>
                  <AntdSelect
                    showSearch
                    placeholder="Selecione"
                    value={contaBancariaId}
                    options={bancos?.map((b) => ({
                      value: b.id,
                      label: b.nome,
                    })) || []}
                    onChange={(val) => setContaBancariaId(val)}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    style={{ width: '100%' }}
                  />
                </div>

                <FormInput
                  label="Observação (opcional)"
                  placeholder="Observação"
                  value={observacaoPagamento}
                  onChange={(e) => setObservacaoPagamento(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {receita && (
          <PaymentsTabs
            tipo="receita"
            entityId={receita.id}
            contasBancarias={bancos || []}
            valorAberto={receita.valor_aberto ?? receita.valor}
            initialPayments={initialPayments}
          />
        )}
      </div>
      )}
    </DialogBase>
  );
}
