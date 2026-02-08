'use client';

import { useEffect, useState } from 'react';
import DialogBase from '@/components/dialogs/DialogBase';
import { Checkbox } from '@/components/ui/checkbox';
import { Select as AntdSelect } from 'antd';
import { toast } from 'sonner';

import { useFormValidation } from '@/hooks/useFormValidation';
import { useLoadAuxiliaryData } from '@/hooks/useLoadAuxiliaryData';
import { despesaCreateSchema } from '@/lib/validation/schemas/despesa';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { applyBackendErrors } from '@/lib/validation/backendErrors';

import PaymentsTabs from '@/components/imports/PaymentsTabs';
import { getBancos } from '@/services/bancos';
import { Favorecido } from '@/types/favorecidos';
import { getFavorecidos } from '@/services/favorecidos';

import {
  Despesa,
  DespesaCreate,
  DespesaUpdate,
} from '@/types/despesas';
import { PaymentUI } from '@/types/payments';

interface DespesaCreateWithPayment extends DespesaCreate {
  marcar_como_pago?: boolean;
  data_pagamento?: string | null;
  conta_bancaria_id?: number;
  observacao_pagamento?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: DespesaCreate | DespesaUpdate) => Promise<void>;
  despesa?: Despesa | null;
  initialBancos?: { id: number; nome: string }[];
  initialFavorecidos?: Favorecido[];
  initialPayments?: PaymentUI[]; // Pagamentos pré-carregados
}

export default function DespesaDialog({
  open,
  onClose,
  onSubmit,
  despesa,
  initialBancos,
  initialFavorecidos,
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

  const { data: favorecidosFromHook, loading: loadingFavorecidos } = useLoadAuxiliaryData({
    loadFn: async () => {
      const res = await getFavorecidos({ page_size: 1000 });
      return res.results;
    },
    onOpen: open && !initialFavorecidos, // Only load if not provided
    errorMessage: 'Erro ao carregar favorecidos',
  });

  // Use initial data if provided, otherwise use hook data
  const bancos = initialBancos || bancosFromHook;
  const favorecidos = initialFavorecidos || favorecidosFromHook;

  // Check if auxiliary data is still loading (only when editing)
  // Considera tanto o estado de loading quanto a disponibilidade dos dados
  const isLoadingAuxData = despesa && (
    (!initialBancos && loadingBancos) ||
    (!initialFavorecidos && loadingFavorecidos) ||
    !bancos ||
    !favorecidos
  );

  // Form validation
  const {
    formData,
    setFormData,
    setFieldError,
    isSubmitting,
    handleSubmit,
    getFieldProps,
  } = useFormValidation<DespesaCreate>(
    {
      nome: '',
      descricao: '',
      responsavel_id: 0,
      valor: 0,
      data_vencimento: '',
      tipo: 'F',
    },
    despesaCreateSchema
  );

  // Payment fields state (only for creation)
  const [marcarComoPago, setMarcarComoPago] = useState(false);
  const [dataPagamento, setDataPagamento] = useState('');
  const [contaBancariaId, setContaBancariaId] = useState<number | undefined>();
  const [observacaoPagamento, setObservacaoPagamento] = useState('');

  // Initialize form when editing
  useEffect(() => {
    if (despesa) {
      setFormData({
        nome: despesa.nome,
        descricao: despesa.descricao,
        responsavel_id: despesa.responsavel?.id ?? despesa.responsavel_id,
        valor: despesa.valor,
        data_vencimento: despesa.data_vencimento,
        tipo: despesa.tipo,
      });
    } else {
      setFormData({
        nome: '',
        descricao: '',
        responsavel_id: 0,
        valor: 0,
        data_vencimento: '',
        tipo: 'F',
      });
      setMarcarComoPago(false);
      setDataPagamento('');
      setContaBancariaId(undefined);
      setObservacaoPagamento('');
    }
  }, [despesa, open, setFormData]);

  const handleSubmitWrapper = async () => {
    await handleSubmit(async (data) => {
      try {
        let payload: DespesaUpdate | DespesaCreate | DespesaCreateWithPayment;

        if (despesa) {
          payload = { ...data } as DespesaUpdate;
        } else {
          payload = { ...data } as DespesaCreate;

          // Add payment data if checkbox is checked
          if (marcarComoPago) {
            const paymentPayload = payload as DespesaCreateWithPayment;
            paymentPayload.marcar_como_pago = true;
            paymentPayload.data_pagamento = dataPagamento;
            paymentPayload.conta_bancaria_id = contaBancariaId;
            paymentPayload.observacao_pagamento = observacaoPagamento;
            payload = paymentPayload;
          }
        }

        await onSubmit(payload);
        onClose();
        toast.success(
          despesa ? 'Despesa atualizada com sucesso' : 'Despesa criada com sucesso'
        );
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
      onClose={onClose}
      title={despesa ? 'Editar Despesa' : 'Nova Despesa'}
      onSubmit={handleSubmitWrapper}
      loading={isSubmitting}
      size="lg"
      maxHeight="max-h-[75vh]"
      compact
    >
      {isLoadingAuxData ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
        {/* Favorecido + Nome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Favorecido <span className="text-red-500">*</span>
            </label>
            <AntdSelect
              showSearch
              allowClear
              placeholder="Selecione um favorecido"
              value={formData.responsavel_id || undefined}
              options={favorecidos?.map((f: Favorecido) => ({
                value: f.id,
                label: f.nome,
              })) || []}
              onChange={(val) =>
                setFormData((prev) => ({
                  ...prev,
                  responsavel_id: val ?? 0,
                }))
              }
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%' }}
              status={getFieldProps('responsavel_id').error ? 'error' : undefined}
            />
            {getFieldProps('responsavel_id').error && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <span className="font-medium">⚠</span> {getFieldProps('responsavel_id').error}
              </p>
            )}
          </div>

          <FormInput
            label="Nome"
            required
            placeholder="Nome da despesa"
            value={formData.nome}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, nome: e.target.value }))
            }
            error={getFieldProps('nome').error}
          />
        </div>

        {/* Descrição */}
        <FormInput
          label="Descrição"
          required
          placeholder="Detalhes sobre a despesa"
          value={formData.descricao}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, descricao: e.target.value }))
          }
          error={getFieldProps('descricao').error}
        />

        {/* Valor / Vencimento / Tipo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            label="Valor (R$)"
            required
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.valor}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))
            }
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
              setFormData((prev) => ({ ...prev, tipo: val as DespesaCreate['tipo'] }))
            }
            options={[
              { value: 'F', label: 'Fixa' },
              { value: 'V', label: 'Variável' },
              { value: 'C', label: 'Comissão' },
              { value: 'R', label: 'Reembolso' },
            ]}
            error={getFieldProps('tipo').error}
          />
        </div>

        {/* Marcar como pago - only when creating */}
        {!despesa && (
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
                  label="Data de Pagamento"
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                />

                <div className="space-y-1">
                  <label className="text-sm font-medium">Conta Bancária</label>
                  <AntdSelect
                    showSearch
                    allowClear
                    placeholder="Selecione uma conta"
                    value={contaBancariaId}
                    options={bancos?.map((b) => ({
                      value: b.id,
                      label: b.nome,
                    })) || []}
                    onChange={(val) => setContaBancariaId(val)}
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    style={{ width: '100%' }}
                  />
                </div>

                <FormInput
                  label="Observação (opcional)"
                  placeholder="Observação do pagamento"
                  value={observacaoPagamento}
                  onChange={(e) => setObservacaoPagamento(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Pagamentos (apenas na edição) */}
        {despesa && (
          <PaymentsTabs
            tipo="despesa"
            entityId={despesa.id}
            contasBancarias={bancos || []}
            valorAberto={despesa.valor_aberto ?? despesa.valor}
            initialPayments={initialPayments}
          />
        )}
      </div>
      )}
    </DialogBase>
  );
}
