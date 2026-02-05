'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, message, Tag } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';

import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import PaymentDialog from '@/components/dialogs/PaymentDialog';
import ImportExtratoDialog from '@/components/dialogs/ImportExtratoDialog';
import { Input } from '@/components/ui/input';

import { getPayments, createPayment, updatePayment, deletePayment } from '@/services/payments';
import { createAllocation, deleteAllocation } from '@/services/allocations';

import { Payment, PaymentCreate } from '@/types/payments';

// Tipo para alocações do formulário
interface AllocationForm {
  id: string;
  tipo: 'receita' | 'despesa' | 'custodia';
  entidade_id: number;
  valor: number;
  valorDisplay: string;
}
import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import { useDebounce } from '@/hooks/useDebounce';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Trash, Upload, Pencil } from 'lucide-react';

export default function ExtratoPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [openImportDialog, setOpenImportDialog] = useState(false);

  // Paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Busca
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

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
      });

      setPayments(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar pagamentos');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ======================
  // ❌ DELETE PAYMENT
  // ======================
  const handleDeletePayment = async (id: number) => {
    if (!confirm('Deseja realmente excluir este pagamento?')) return;

    try {
      await deletePayment(id);
      toast.success('Pagamento excluído com sucesso!');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir pagamento');
    }
  };

  // ======================
  // ❌ BULK DELETE
  // ======================
  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Selecione pelo menos um pagamento');
      return;
    }

    if (!confirm(`Deseja realmente excluir ${selectedRowKeys.length} pagamento(s)?`)) return;

    try {
      setLoading(true);

      await Promise.all(
        selectedRowKeys.map((id) => deletePayment(Number(id)))
      );

      toast.success(`${selectedRowKeys.length} pagamento(s) excluído(s) com sucesso`);
      setSelectedRowKeys([]);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir pagamentos');
    } finally {
      setLoading(false);
    }
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
    data: PaymentCreate & { allocations?: AllocationForm[] }
  ) => {
    try {
      if (editingPayment) {
        // EDIÇÃO: Atualiza o pagamento existente
        await updatePayment(editingPayment.id, {
          tipo: data.tipo,
          conta_bancaria: data.conta_bancaria,
          valor: data.valor,
          data_pagamento: data.data_pagamento,
          observacao: data.observacao,
        });

        // Deleta todas as alocações antigas
        if (editingPayment.allocations_info && editingPayment.allocations_info.length > 0) {
          await Promise.all(
            editingPayment.allocations_info.map((alloc) =>
              deleteAllocation(alloc.id)
            )
          );
        }

        // Cria as novas alocações
        if (data.allocations && data.allocations.length > 0) {
          await Promise.all(
            data.allocations.map((alloc) =>
              createAllocation({
                payment_id: editingPayment.id,
                [`${alloc.tipo}_id`]: alloc.entidade_id,
                valor: alloc.valor,
                observacao: data.observacao,
              })
            )
          );
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

        // Se há alocações, criar cada uma
        if (data.allocations && data.allocations.length > 0) {
          await Promise.all(
            data.allocations.map((alloc) =>
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
      title: 'Tipo',
      dataIndex: 'tipo',
      width: '10%',
      render: (tipo: 'E' | 'S') => (
        <Tag color={tipo === 'E' ? 'green' : 'red'}>
          {tipo === 'E' ? 'Entrada' : 'Saída'}
        </Tag>
      ),
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
      width: '25%',
      render: (_: unknown, record: Payment) => {
        if (record.allocations_info && record.allocations_info.length > 0) {
          return record.allocations_info.map((alloc, idx) => {
            if (alloc.receita) {
              return (
                <div key={idx} className="text-sm">
                  <span className="font-medium">Receita:</span> {alloc.receita.nome}
                </div>
              );
            }
            if (alloc.despesa) {
              return (
                <div key={idx} className="text-sm">
                  <span className="font-medium">Despesa:</span> {alloc.despesa.nome}
                </div>
              );
            }
            if (alloc.custodia) {
              return (
                <div key={idx} className="text-sm">
                  <span className="font-medium">Custódia:</span> {alloc.custodia.nome}
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
      width: '15%',
      render: (v: number, record: Payment) => (
        <span className={record.tipo === 'E' ? 'text-green-600' : 'text-red-600'}>
          {formatCurrencyBR(v)}
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

      <main className="bg-muted min-h-screen w-full p-6">
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
              className="shadow-md"
              onClick={() => setOpenImportDialog(true)}
              icon={<Upload className="w-4 h-4" />}
            >
              Importar de Extrato Bancário
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
      </main>
    </div>
  );
}
