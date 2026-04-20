'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';

import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import PaymentDialog from '@/components/dialogs/PaymentDialog';
import ImportExtratoDialog from '@/components/dialogs/ImportExtratoDialog';
import ConciliacaoBancariaDialog from '@/components/dialogs/ConciliacaoBancariaDialog';
import { Input } from '@/components/ui/input';
import DateRangeFilter from '@/components/ui/DateRangeFilter';

import { getPayments, createPayment, updatePayment, deletePayment } from '@/services/payments';
import { createAllocation, deleteAllocation } from '@/services/allocations';
import { gerarComissoes } from '@/services/clientes';

import { Payment, PaymentCreate } from '@/types/payments';

// Tipo para alocações do formulário
interface AllocationForm {
  id: string;
  allocation_id?: number;
  tipo: 'receita' | 'despesa' | 'custodia' | 'transfer';
  entidade_id: number;
  valor: number;
  valorDisplay: string;
  isExisting?: boolean;
  isDeleted?: boolean;
}
import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import { useDebounce } from '@/hooks/useDebounce';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Trash, Upload, Pencil, GitMerge, Coins } from 'lucide-react';
import { getErrorMessage } from '@/lib/errors';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';

export default function ExtratoPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [openConciliacaoDialog, setOpenConciliacaoDialog] = useState(false);

  // Paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Busca
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // 📅 Filtro por data
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Gerar comissões state
  const [openGerarComissoes, setOpenGerarComissoes] = useState(false);
  const [mesComissao, setMesComissao] = useState(new Date().getMonth() + 1);
  const [anoComissao, setAnoComissao] = useState(new Date().getFullYear());
  const [loadingComissoes, setLoadingComissoes] = useState(false);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, startDate, endDate]);

  // Clear selection when page or pageSize changes
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [page, pageSize]);

  // ======================
  // 🔄 LOAD PAYMENTS
  // ======================
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const res = await getPayments({
        page,
        page_size: pageSize,
        search: debouncedSearch,
        start_date: startDate,
        end_date: endDate,
      });

      setPayments(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar pagamentos');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ======================
  // 💰 GERAR COMISSÕES
  // ======================
  const handleGerarComissoes = async () => {
    try {
      setLoadingComissoes(true);
      const result = await gerarComissoes(mesComissao, anoComissao);

      if (result.comissionados && result.comissionados.length > 0) {
        toast.success(
          `Comissões geradas com sucesso! ${result.comissionados.length} comissionado(s), total: R$ ${result.total.toFixed(2)}`
        );
      } else {
        toast.info(`Nenhuma comissão gerada para ${mesComissao}/${anoComissao}`);
      }

      setOpenGerarComissoes(false);
    } catch (error: unknown) {
      console.error(error);
      toast.error(getErrorMessage(error, 'Erro ao gerar comissões'));
    } finally {
      setLoadingComissoes(false);
    }
  };

  // ======================
  // ❌ DELETE PAYMENT
  // ======================
  const handleDeletePaymentAction = async (id: number) => {
    try {
      await deletePayment(id);
      toast.success('Pagamento excluído com sucesso!');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir pagamento');
    }
  };

  const handleBulkDeleteAction = async (ids: number[]) => {
    try {
      setLoading(true);

      await Promise.all(
        ids.map((id) => deletePayment(id))
      );

      toast.success(`${ids.length} pagamento(s) excluído(s) com sucesso`);
      setSelectedRowKeys([]);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const {
    confirmState,
    confirmDelete,
    confirmBulkDelete,
    handleConfirm,
    handleCancel,
  } = useDeleteConfirmation({
    onDelete: handleDeletePaymentAction,
    onBulkDelete: handleBulkDeleteAction,
  });

  const handleDeletePayment = (id: number) => {
    const payment = payments.find((p) => p.id === id);
    confirmDelete(id, payment?.observacao);
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Selecione pelo menos um pagamento');
      return;
    }
    confirmBulkDelete(selectedRowKeys.map(Number));
  };

  // ======================
  // 🔘 ROW SELECTION
  // ======================
  const handleSelectionChange = (selectedKeys: React.Key[]) => {
    setSelectedRowKeys(selectedKeys);
  };

  // ======================
  // 💾 CREATE/UPDATE PAYMENT
  // ======================
  const handleSubmit = async (
    data: PaymentCreate & {
      allocations?: AllocationForm[];
      allocationsToDelete?: number[];
    }
  ) => {
    try {
      // Filtrar e validar alocações
      if (data.allocations && data.allocations.length > 0) {
        // Separar alocações válidas das inválidas
        const validAllocations = data.allocations.filter(
          (alloc) => alloc.entidade_id && alloc.entidade_id > 0 && alloc.valor && alloc.valor > 0
        );

        const incompleteAllocs = data.allocations.filter(
          (alloc) => !alloc.entidade_id || alloc.entidade_id === 0 || !alloc.valor || alloc.valor <= 0
        );

        // Se houver alocações incompletas, avisar mas continuar apenas com as válidas
        if (incompleteAllocs.length > 0) {
          toast.warning(`${incompleteAllocs.length} alocação(ões) incompleta(s) foi(ram) ignorada(s)`);
        }

        // Substituir allocations com apenas as válidas
        data.allocations = validAllocations;

        // Validar que o total alocado não excede o valor do payment
        if (validAllocations.length > 0) {
          const totalAlocado = validAllocations.reduce((sum, alloc) => sum + alloc.valor, 0);

          if (totalAlocado > data.valor) {
            toast.error(`Total alocado (R$ ${totalAlocado.toFixed(2)}) excede o valor do pagamento (R$ ${data.valor.toFixed(2)})`);
            return;
          }
        }
      }

      if (editingPayment) {
        // EDIÇÃO: Atualiza o pagamento existente
        await updatePayment(editingPayment.id, {
          tipo: data.tipo,
          conta_bancaria: data.conta_bancaria,
          valor: data.valor,
          data_pagamento: data.data_pagamento,
          observacao: data.observacao,
        });

        // Deleta apenas as alocações marcadas para deletar
        if (data.allocationsToDelete && data.allocationsToDelete.length > 0) {
          await Promise.all(
            data.allocationsToDelete.map((allocId) =>
              deleteAllocation(allocId)
            )
          );
        }

        // Cria apenas as NOVAS alocações (que não são existentes)
        if (data.allocations && data.allocations.length > 0) {
          const newAllocations = data.allocations.filter(
            (alloc) => !alloc.isExisting && alloc.entidade_id && alloc.entidade_id > 0
          );

          if (newAllocations.length > 0) {
            await Promise.all(
              newAllocations.map((alloc) =>
                createAllocation({
                  payment_id: editingPayment.id,
                  [`${alloc.tipo}_id`]: alloc.entidade_id,
                  valor: alloc.valor,
                  observacao: data.observacao,
                })
              )
            );
          }
        }

        toast.success('Pagamento atualizado com sucesso!');
      } else {
        // CRIAÇÃO: Cria um novo pagamento
        const novoPayment = await createPayment({
          tipo: data.tipo,
          conta_bancaria: data.conta_bancaria,
          valor: data.valor,
          data_pagamento: data.data_pagamento,
          observacao: data.observacao,
        });

        // Se há alocações, criar cada uma (apenas as válidas)
        if (data.allocations && data.allocations.length > 0) {
          await Promise.all(
            data.allocations
              .filter((alloc) => alloc.entidade_id && alloc.entidade_id > 0)
              .map((alloc) =>
                createAllocation({
                  payment_id: novoPayment.id,
                  [`${alloc.tipo}_id`]: alloc.entidade_id,
                  valor: alloc.valor,
                  observacao: data.observacao,
                })
              )
          );
        }

        toast.success('Pagamento criado com sucesso!');
      }

      setOpenDialog(false);
      setEditingPayment(null);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error(editingPayment ? 'Erro ao atualizar pagamento' : 'Erro ao criar pagamento');
      throw error;
    }
  };

  // ======================
  // ✏️ EDIT PAYMENT
  // ======================
  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setOpenDialog(true);
  };

  // ======================
  // 📊 TABELA
  // ======================
  const columns: TableColumnsType<Payment> = [
    {
      title: 'Data',
      dataIndex: 'data_pagamento',
      width: '12%',
      render: (value) => formatDateBR(value),
    },
    {
      title: 'Conta Bancária',
      dataIndex: 'conta_bancaria_nome',
      width: '18%',
      render: (nome) => nome ?? '—',
    },
    {
      title: 'Vinculado a',
      key: 'vinculo',
      width: '20%',
      render: (_: unknown, record: Payment) => {
        if (record.allocations_info && record.allocations_info.length > 0) {
          return record.allocations_info.map((alloc, idx) => {
            if (alloc.receita) {
              return (
                <div key={idx} className="text-sm">
                  {alloc.receita.nome}
                </div>
              );
            }
            if (alloc.despesa) {
              return (
                <div key={idx} className="text-sm">
                  {alloc.despesa.nome}
                </div>
              );
            }
            if (alloc.custodia) {
              return (
                <div key={idx} className="text-sm">
                  {alloc.custodia.nome}
                </div>
              );
            }
            if (alloc.transfer) {
              return (
                <div key={idx} className="text-sm">
                  {alloc.transfer.from_bank} → {alloc.transfer.to_bank}
                </div>
              );
            }
            return null;
          });
        }
        return <span className="text-muted-foreground text-sm">Sem vínculo</span>;
      },
    },
    {
      title: 'Valor',
      dataIndex: 'valor',
      width: '12%',
      render: (v: number, record: Payment) => (
        <span className={record.tipo === 'E' ? 'text-green-600' : 'text-red-600'}>
          {formatCurrencyBR(v)}
        </span>
      ),
    },
    {
      title: 'Observação',
      dataIndex: 'observacao',
      width: '30%',
      render: (obs: string) => (
        <span className="text-sm truncate block" title={obs}>
          {obs || '—'}
        </span>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '8%',
      render: (_: unknown, record: Payment) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Editar',
              icon: Pencil,
              onClick: () => handleEditPayment(record),
            },
            {
              label: 'Excluir',
              icon: Trash,
              danger: true,
              onClick: () => handleDeletePayment(record.id),
            },
          ]}
        />
      ),
    },
  ];

  // ======================
  // 🧱 RENDER
  // ======================
  return (
    <div className="flex">
      <NavbarNested />

      <main className="main-content-with-navbar bg-muted min-h-screen w-full p-6">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-serif font-bold text-navy">
            Extrato de Pagamentos
          </h1>

          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Buscar pagamentos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-80"
            />

            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => {
                setStartDate(s);
                setEndDate(e);
              }}
            />

            {selectedRowKeys.length > 0 && (
              <Button
                danger
                className="shadow-md"
                onClick={handleBulkDelete}
                icon={<Trash className="w-4 h-4" />}
              >
                Excluir {selectedRowKeys.length} selecionado(s)
              </Button>
            )}

            <Button
              className="shadow-md bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => setOpenGerarComissoes(true)}
              icon={<Coins className="w-4 h-4" />}
            >
              Gerar Comissões de Clientes
            </Button>

            <Button
              className="shadow-md"
              onClick={() => setOpenConciliacaoDialog(true)}
              icon={<GitMerge className="w-4 h-4" />}
            >
              Automatizar Conciliação
            </Button>

            <Button
              className="shadow-md"
              onClick={() => setOpenImportDialog(true)}
              icon={<Upload className="w-4 h-4" />}
            >
              Importar
            </Button>

            <Button
              type="primary"
              className="shadow-md bg-navy text-white hover:bg-navy/90"
              onClick={() => {
                setEditingPayment(null);
                setOpenDialog(true);
              }}
            >
              Novo Pagamento
            </Button>
          </div>
        </div>

        <GenericTable<Payment>
          columns={columns}
          data={payments}
          loading={loading}
          pagination={{
            total,
            current: page,
            pageSize,
            onChange: (page) => setPage(page),
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onShowSizeChange: (_, size) => {
              setPageSize(size);
              setPage(1);
            },
          }}
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={handleSelectionChange}
        />

        {/* DIALOG PAYMENT */}
        <PaymentDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingPayment(null);
          }}
          onSubmit={handleSubmit}
          payment={editingPayment}
        />

        {/* DIALOG IMPORT EXTRATO */}
        <ImportExtratoDialog
          open={openImportDialog}
          onClose={() => setOpenImportDialog(false)}
          onSuccess={loadData}
        />

        {/* DIALOG CONCILIAÇÃO BANCÁRIA */}
        <ConciliacaoBancariaDialog
          open={openConciliacaoDialog}
          onClose={() => setOpenConciliacaoDialog(false)}
          onSuccess={loadData}
        />

        {/* Modal de Gerar Comissões */}
        <Dialog open={openGerarComissoes} onOpenChange={setOpenGerarComissoes}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Gerar Comissões</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Mês</label>
                <Select
                  value={mesComissao.toString()}
                  onValueChange={(val) => setMesComissao(Number(val))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {new Date(2000, m - 1).toLocaleDateString('pt-BR', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Ano</label>
                <Select
                  value={anoComissao.toString()}
                  onValueChange={(val) => setAnoComissao(Number(val))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => setOpenGerarComissoes(false)}
                className="mr-2"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleGerarComissoes}
                className="bg-navy text-white hover:bg-navy/90"
                loading={loadingComissoes}
                disabled={loadingComissoes}
              >
                Gerar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DeleteConfirmationDialog
          open={confirmState.isOpen}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          title={confirmState.isBulk ? 'Excluir pagamentos selecionados?' : 'Excluir pagamento?'}
          itemName={confirmState.itemName}
          isBulk={confirmState.isBulk}
          itemCount={confirmState.itemIds.length}
        />
      </main>
    </div>
  );
}
