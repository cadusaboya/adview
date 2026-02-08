'use client';

import { useEffect, useState } from 'react';
import DialogBase from '@/components/dialogs/DialogBase';
import { Select as AntdSelect } from 'antd';
import { toast } from 'sonner';

import { useFormValidation } from '@/hooks/useFormValidation';
import { useLoadAuxiliaryData } from '@/hooks/useLoadAuxiliaryData';
import { custodiaCreateSchema } from '@/lib/validation/schemas/custodia';
import { FormInput } from '@/components/form/FormInput';
import { applyBackendErrors } from '@/lib/validation/backendErrors';

import PaymentsTabs from '@/components/imports/PaymentsTabs';
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
}

export default function CustodiaDialog({
  open,
  onClose,
  onSubmit,
  custodia,
  tipo,
}: Props) {
  const [pessoaTipo, setPessoaTipo] = useState<'cliente' | 'funcionario' | null>(null);

  // Load auxiliary data in parallel
  const { data: funcionarios, loading: loadingFuncionarios } = useLoadAuxiliaryData({
    loadFn: async () => {
      const res = await getFuncionarios({ page_size: 1000 });
      return res.results;
    },
    onOpen: open,
    errorMessage: 'Erro ao carregar funcionários',
  });

  const { data: clientes, loading: loadingClientes } = useLoadAuxiliaryData({
    loadFn: async () => {
      const res = await getClientes({ page_size: 1000 });
      return res.results;
    },
    onOpen: open,
    errorMessage: 'Erro ao carregar clientes',
  });

  const { data: bancos, loading: loadingBancos } = useLoadAuxiliaryData({
    loadFn: async () => {
      const res = await getBancos({ page_size: 1000 });
      return res.results.map((b) => ({ id: b.id, nome: b.nome }));
    },
    onOpen: open,
    errorMessage: 'Erro ao carregar bancos',
  });

  // Check if auxiliary data is still loading (only when editing)
  // Considera tanto o estado de loading quanto a disponibilidade dos dados
  const isLoadingAuxData = custodia && (
    loadingFuncionarios ||
    loadingClientes ||
    loadingBancos ||
    !funcionarios ||
    !clientes ||
    !bancos
  );

  // Form validation
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

  // Initialize form when editing
  useEffect(() => {
    if (custodia) {
      setFormData({
        nome: custodia.nome,
        descricao: custodia.descricao,
        cliente_id: custodia.cliente?.id ?? null,
        funcionario_id: custodia.funcionario?.id ?? null,
        valor_total: custodia.valor_total,
      });

      // Determinar tipo de pessoa
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
      setPessoaTipo(null);
    }
  }, [custodia, open, setFormData]);

  const handleSubmitWrapper = async () => {
    // Validate that at least one person type is selected
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
          tipo, // Usa o tipo recebido da página
        };

        // Limpar o campo que não está sendo usado
        if (pessoaTipo === 'cliente') {
          payload.funcionario_id = null;
        } else if (pessoaTipo === 'funcionario') {
          payload.cliente_id = null;
        }

        await onSubmit(payload);
        onClose();
        toast.success(
          custodia ? 'Custódia atualizada com sucesso' : 'Custódia criada com sucesso'
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
      onSubmit={handleSubmitWrapper}
      title={custodia ? 'Editar Custódia' : 'Criar Custódia'}
      loading={isSubmitting}
    >
      {isLoadingAuxData ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        </div>
      ) : (
        <div className="space-y-4">
        {/* Nome e Valor Total */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Nome"
            required
            placeholder="Digite o nome da custódia"
            value={formData.nome}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, nome: e.target.value }))
            }
            error={getFieldProps('nome').error}
          />

          <FormInput
            label="Valor Total"
            required
            type="number"
            step="0.01"
            placeholder="0.00"
            value={formData.valor_total}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, valor_total: parseFloat(e.target.value) || 0 }))
            }
            error={getFieldProps('valor_total').error}
          />
        </div>

        {/* Descrição */}
        <FormInput
          label="Descrição"
          placeholder="Digite uma descrição (opcional)"
          value={formData.descricao ?? ''}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, descricao: e.target.value }))
          }
          error={getFieldProps('descricao').error}
        />

        {/* Tipo de Pessoa e Seleção */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Tipo de Pessoa <span className="text-red-500">*</span>
            </label>
            <AntdSelect
              placeholder="Selecione o tipo de pessoa"
              value={pessoaTipo}
              onChange={(value) => {
                setPessoaTipo(value);
                // Limpar seleções anteriores
                setFormData((prev) => ({
                  ...prev,
                  cliente_id: null,
                  funcionario_id: null,
                }));
              }}
              style={{ width: '100%' }}
              options={[
                { value: 'cliente', label: 'Cliente' },
                { value: 'funcionario', label: 'Funcionário/Fornecedor/Parceiro' },
              ]}
            />
          </div>

          {/* Cliente */}
          {pessoaTipo === 'cliente' && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Cliente <span className="text-red-500">*</span>
              </label>
              <AntdSelect
                showSearch
                placeholder="Selecione o cliente"
                value={formData.cliente_id}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, cliente_id: value }))
                }
                style={{ width: '100%' }}
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
            </div>
          )}

          {/* Funcionário */}
          {pessoaTipo === 'funcionario' && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Funcionário/Fornecedor/Parceiro <span className="text-red-500">*</span>
              </label>
              <AntdSelect
                showSearch
                placeholder="Selecione o funcionário"
                value={formData.funcionario_id}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, funcionario_id: value }))
                }
                style={{ width: '100%' }}
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
            </div>
          )}
        </div>

        {/* Pagamentos (apenas na edição) */}
        {custodia && (
          <PaymentsTabs
            tipo="custodia"
            entityId={custodia.id}
            contasBancarias={bancos || []}
            custodiaTipo={custodia.tipo}
            valorAberto={custodia.valor_total - custodia.valor_liquidado}
          />
        )}
      </div>
      )}
    </DialogBase>
  );
}
