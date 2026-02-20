'use client';

import { useEffect, useState } from 'react';
import DialogBase from '@/components/dialogs/DialogBase';
import { SortedSelect as AntdSelect } from '@/components/ui/SortedSelect';
import { toast } from 'sonner';

import { useFormValidation } from '@/hooks/useFormValidation';
import { useLoadAuxiliaryData } from '@/hooks/useLoadAuxiliaryData';
import { custodiaCreateSchema } from '@/lib/validation/schemas/custodia';
import { FormInput } from '@/components/form/FormInput';
import { applyBackendErrors } from '@/lib/validation/backendErrors';
import { formatCurrencyInput, parseCurrencyBR } from '@/lib/formatters';

import CustodiaPaymentsTabs from '@/components/imports/CustodiaPaymentsTabs';
import { getFuncionarios } from '@/services/funcionarios';
import { getClientes } from '@/services/clientes';
import { getBancos } from '@/services/bancos';

import { Funcionario } from '@/types/funcionarios';
import { Cliente } from '@/types/clientes';
import {
  Custodia,
  CustodiaCreate,
  CustodiaUpdate,
} from '@/types/custodias';
interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CustodiaCreate | CustodiaUpdate) => Promise<void>;
  custodia?: Custodia | null;
  tipo: 'P' | 'A'; // P = Passivo, A = Ativo (vem da página)
  initialFuncionarios?: Funcionario[];
  initialClientes?: Cliente[];
  initialBancos?: { id: number; nome: string }[];
}

export default function CustodiaDialog({
  open,
  onClose,
  onSubmit,
  custodia,
  tipo,
  initialFuncionarios,
  initialClientes,
  initialBancos,
}: Props) {
  const [pessoaTipo, setPessoaTipo] = useState<'cliente' | 'funcionario' | null>(null);
  const [valorDisplay, setValorDisplay] = useState('');

  // Load auxiliary data in parallel (or use initial data if provided)
  const { data: funcionariosFromHook, loading: loadingFuncionarios } = useLoadAuxiliaryData({
    loadFn: async () => {
      const res = await getFuncionarios({ page_size: 1000 });
      return res.results;
    },
    onOpen: open && !initialFuncionarios,
    errorMessage: 'Erro ao carregar funcionários',
    cacheData: false,
  });

  const { data: clientesFromHook, loading: loadingClientes } = useLoadAuxiliaryData({
    loadFn: async () => {
      const res = await getClientes({ page_size: 1000 });
      return res.results;
    },
    onOpen: open && !initialClientes,
    errorMessage: 'Erro ao carregar clientes',
    cacheData: false,
  });

  const { data: bancosFromHook, loading: loadingBancos } = useLoadAuxiliaryData({
    loadFn: async () => {
      const res = await getBancos({ page_size: 1000 });
      return res.results.map((b) => ({ id: b.id, nome: b.nome }));
    },
    onOpen: open && !initialBancos,
    errorMessage: 'Erro ao carregar bancos',
  });

  const funcionarios = initialFuncionarios || funcionariosFromHook;
  const clientes = initialClientes || clientesFromHook;
  const bancos = initialBancos || bancosFromHook;

  const isLoadingAuxData = custodia && (
    (!initialFuncionarios && loadingFuncionarios) ||
    (!initialClientes && loadingClientes) ||
    (!initialBancos && loadingBancos) ||
    !funcionarios ||
    !clientes ||
    !bancos
  );

  const {
    formData,
    setFormData,
    setFieldError,
    isSubmitting,
    handleSubmit,
    getFieldProps,
  } = useFormValidation<Omit<CustodiaCreate, 'tipo'>>({
    nome: '',
    descricao: '',
    cliente_id: null,
    funcionario_id: null,
    valor_total: 0,
  }, {
    nome: custodiaCreateSchema.nome!,
    descricao: custodiaCreateSchema.descricao!,
    cliente_id: custodiaCreateSchema.cliente_id!,
    funcionario_id: custodiaCreateSchema.funcionario_id!,
    valor_total: custodiaCreateSchema.valor_total!,
  });

  useEffect(() => {
    if (custodia) {
      setFormData({
        nome: custodia.nome,
        descricao: custodia.descricao,
        cliente_id: custodia.cliente?.id ?? null,
        funcionario_id: custodia.funcionario?.id ?? null,
        valor_total: custodia.valor_total,
      });
      setValorDisplay(formatCurrencyInput(custodia.valor_total));

      if (custodia.cliente) {
        setPessoaTipo('cliente');
      } else if (custodia.funcionario) {
        setPessoaTipo('funcionario');
      }
    } else {
      setFormData({
        nome: '',
        descricao: '',
        cliente_id: null,
        funcionario_id: null,
        valor_total: 0,
      });
      setValorDisplay('');
      setPessoaTipo(null);
    }
  }, [custodia, open, setFormData]);

  const handleSubmitWrapper = async () => {
    if (!pessoaTipo) {
      toast.error('Selecione o tipo de pessoa (Cliente ou Funcionário)');
      return;
    }

    if (pessoaTipo === 'cliente' && !formData.cliente_id) {
      toast.error('Selecione um cliente');
      return;
    }

    if (pessoaTipo === 'funcionario' && !formData.funcionario_id) {
      toast.error('Selecione um funcionário');
      return;
    }

    await handleSubmit(async (data) => {
      try {
        const payload: CustodiaCreate | CustodiaUpdate = {
          ...data,
          tipo,
        };

        if (pessoaTipo === 'cliente') {
          payload.funcionario_id = null;
        } else if (pessoaTipo === 'funcionario') {
          payload.cliente_id = null;
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

  const tipoLabel = tipo === 'A' ? 'Ativa' : 'Passiva';
  const title = custodia
    ? `Editar Custódia ${tipoLabel}`
    : `Nova Custódia ${tipoLabel}`;

  return (
    <DialogBase
      open={open}
      onClose={onClose}
      onSubmit={handleSubmitWrapper}
      title={title}
      size={custodia ? 'xl' : 'md'}
      compact
      loading={isSubmitting}
    >
      {isLoadingAuxData ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" />
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Nome + Valor Total */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <FormInput
                label="Nome"
                required
                placeholder="Nome da custódia"
                value={formData.nome}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, nome: e.target.value }))
                }
                error={getFieldProps('nome').error}
              />
            </div>
            <FormInput
              label="Valor Total (R$)"
              required
              placeholder="0,00"
              value={valorDisplay}
              onChange={(e) => setValorDisplay(e.target.value)}
              onBlur={() => {
                const parsed = parseCurrencyBR(valorDisplay);
                setValorDisplay(parsed ? formatCurrencyInput(parsed) : '');
                setFormData((prev) => ({ ...prev, valor_total: parsed }));
              }}
              error={getFieldProps('valor_total').error}
            />
          </div>

          {/* Descrição */}
          <FormInput
            label="Descrição"
            placeholder="Descrição (opcional)"
            value={formData.descricao ?? ''}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, descricao: e.target.value }))
            }
            error={getFieldProps('descricao').error}
          />

          {/* Contraparte — toggle + select inline */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Contraparte <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="flex gap-1 flex-shrink-0">
                {(['cliente', 'funcionario'] as const).map((tipoPessoa) => (
                  <button
                    key={tipoPessoa}
                    type="button"
                    onClick={() => {
                      setPessoaTipo(tipoPessoa);
                      setFormData((prev) => ({
                        ...prev,
                        cliente_id: null,
                        funcionario_id: null,
                      }));
                    }}
                    className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors whitespace-nowrap ${
                      pessoaTipo === tipoPessoa
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-input hover:bg-muted'
                    }`}
                  >
                    {tipoPessoa === 'cliente' ? 'Cliente' : 'Funcionário / Parceiro'}
                  </button>
                ))}
              </div>

              {pessoaTipo === 'cliente' && (
                <AntdSelect
                  showSearch
                  placeholder="Selecione o cliente"
                  value={formData.cliente_id}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, cliente_id: value }))
                  }
                  style={{ flex: 1 }}
                  filterOption={(input, option) =>
                    String(option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={clientes?.map((c: Cliente) => ({
                    value: c.id,
                    label: c.nome,
                  })) || []}
                />
              )}

              {pessoaTipo === 'funcionario' && (
                <AntdSelect
                  showSearch
                  placeholder="Selecione o funcionário / parceiro"
                  value={formData.funcionario_id}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, funcionario_id: value }))
                  }
                  style={{ flex: 1 }}
                  filterOption={(input, option) =>
                    String(option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={funcionarios?.map((f: Funcionario) => ({
                    value: f.id,
                    label: f.nome,
                  })) || []}
                />
              )}
            </div>
          </div>

          {/* Pagamentos — apenas na edição */}
          {custodia && (
            <div className="border-t pt-5 space-y-3">
              <h3 className="text-sm font-semibold">Pagamentos</h3>
              <CustodiaPaymentsTabs
                custodia={custodia}
                contasBancarias={bancos || []}
              />
            </div>
          )}

        </div>
      )}
    </DialogBase>
  );
}
