'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';

import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import CustodiaDialog from '@/components/dialogs/CustodiaDialog';
import { Input } from '@/components/ui/input';
import { Select } from 'antd';

import {
  getCustodias,
  createCustodia,
  updateCustodia,
  deleteCustodia,
} from '@/services/custodias';

import {
  Custodia,
  CustodiaCreate,
  CustodiaUpdate,
} from '@/types/custodias';

import { formatCurrencyBR } from '@/lib/formatters';
import { useDebounce } from '@/hooks/useDebounce';
import { getFuncionarios } from '@/services/funcionarios';
import { getClientes } from '@/services/clientes';
import { getBancos } from '@/services/bancos';
import { Funcionario } from '@/types/funcionarios';
import { Cliente } from '@/types/clientes';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Pencil, Trash } from 'lucide-react';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';

export default function PassivosPage() {
  const [custodias, setCustodias] = useState<Custodia[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCustodia, setEditingCustodia] = useState<Custodia | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Auxiliary data for prefetch
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionariosLoaded, setFuncionariosLoaded] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesLoaded, setClientesLoaded] = useState(false);
  const [bancos, setBancos] = useState<{ id: number; nome: string }[]>([]);
  const [bancosLoaded, setBancosLoaded] = useState(false);

  // ======================
  // 🔄 LOAD DATA
  // ======================
  const loadCustodias = useCallback(async () => {
    try {
      setLoading(true);
      const params: { page: number; page_size: number; search: string; tipo: 'A' | 'P'; status?: string } = {
        page,
        page_size: pageSize,
        search: debouncedSearch,
        tipo: 'P',
      };

      // Aplicar filtro de status
      if (statusFilter !== 'todos') {
        params.status = statusFilter;
      }

      const res = await getCustodias(params);
      setCustodias(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error('Erro ao buscar passivos de custódia:', error);
      message.error('Erro ao buscar passivos de custódia');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter]);

  useEffect(() => {
    loadCustodias();
  }, [loadCustodias]);

  // Reset page when search or status filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  // Clear selection when page or pageSize changes
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [page, pageSize]);

  // ======================
  // 🔄 PREFETCH AUXILIARY DATA
  // ======================
  const loadFuncionarios = async () => {
    if (funcionariosLoaded) return;
    try {
      const res = await getFuncionarios({ page_size: 1000 });
      setFuncionarios(res.results);
      setFuncionariosLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    }
  };

  const loadClientes = async () => {
    if (clientesLoaded) return;
    try {
      const res = await getClientes({ page_size: 1000 });
      setClientes(res.results);
      setClientesLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadBancos = async () => {
    if (bancosLoaded) return;
    try {
      const res = await getBancos({ page_size: 1000 });
      setBancos(res.results.map((b) => ({ id: b.id, nome: b.nome })));
      setBancosLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar bancos:', error);
    }
  };

  const prefetchAuxiliaryData = async () => {
    await Promise.all([
      loadFuncionarios(),
      loadClientes(),
      loadBancos(),
    ]);
  };

  // ======================
  // ❌ DELETE
  // ======================
  const handleDeleteAction = async (id: number) => {
    try {
      await deleteCustodia(id);
      toast.success('Passivo de custódia excluído com sucesso!');
      loadCustodias();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir passivo de custódia');
    }
  };

  const handleBulkDeleteAction = async (ids: number[]) => {
    try {
      setLoading(true);

      // Delete all selected items
      await Promise.all(
        ids.map((id) => deleteCustodia(id))
      );

      toast.success(`${ids.length} passivo(s) de custódia excluído(s) com sucesso`);
      setSelectedRowKeys([]);
      loadCustodias();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir passivos de custódia');
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
    onDelete: handleDeleteAction,
    onBulkDelete: handleBulkDeleteAction,
  });

  const handleDelete = (id: number) => {
    const custodia = custodias.find((c) => c.id === id);
    confirmDelete(id, custodia?.descricao);
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Selecione pelo menos um passivo');
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
  // 💾 CREATE / UPDATE
  // ======================
  const handleSubmit = async (
    data: CustodiaCreate | CustodiaUpdate
  ) => {
    try {
      if (editingCustodia) {
        await updateCustodia(
          editingCustodia.id,
          data as CustodiaUpdate
        );
        toast.success('Passivo de custódia atualizado com sucesso!');
      } else {
        await createCustodia(data as CustodiaCreate);
        toast.success('Passivo de custódia criado com sucesso!');
      }

      setOpenDialog(false);
      setEditingCustodia(null);
      loadCustodias();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar passivo de custódia');
      throw error;
    }
  };

  // ======================
  // 📊 TABELA
  // ======================
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; bg: string }> = {
      'Aberto': { color: 'text-red-600', bg: 'bg-red-50' },
      'Parcial': { color: 'text-yellow-600', bg: 'bg-yellow-50' },
      'Liquidado': { color: 'text-green-600', bg: 'bg-green-50' },
    };

    const statusStyle = statusMap[status] || { color: 'text-gray-600', bg: 'bg-gray-50' };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyle.color} ${statusStyle.bg}`}>
        {status}
      </span>
    );
  };

  const columns: TableColumnsType<Custodia> = [
    {
      title: 'Contraparte',
      key: 'contraparte',
      width: '25%',
      render: (_: unknown, record: Custodia) => {
        if (record.cliente) {
          return record.cliente.nome;
        }
        if (record.funcionario) {
          return record.funcionario.nome;
        }
        return '—';
      },
    },
    {
      title: 'Nome',
      dataIndex: 'nome',
      width: '30%',
    },
    {
      title: 'Saldo',
      key: 'saldo',
      width: '15%',
      render: (_: unknown, record: Custodia) => {
        const saldo = record.valor_total - record.valor_liquidado;
        return formatCurrencyBR(saldo);
      },
    },
    {
      title: 'Status',
      dataIndex: 'status_display',
      width: '15%',
      render: (status: string) => getStatusBadge(status),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '15%',
      render: (_: unknown, record: Custodia) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Editar',
              icon: Pencil,
              onClick: async () => {
                setEditingCustodia(record);
                setOpenDialog(true);
                // Prefetch auxiliary data in background
                await prefetchAuxiliaryData();
              },
            },
            {
              label: 'Excluir',
              icon: Trash,
              danger: true,
              onClick: () => handleDelete(record.id),
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
            Passivos de Custódia
          </h1>

          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Buscar passivos de custódia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-80"
            />

            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-48"
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'A', label: 'Aberto' },
                { value: 'P', label: 'Parcial' },
                { value: 'L', label: 'Liquidado' },
              ]}
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
              className="shadow-md bg-navy text-white hover:bg-navy/90"
              onClick={() => {
                setEditingCustodia(null);
                setOpenDialog(true);
              }}
            >
              Criar Passivo
            </Button>
          </div>
        </div>

        <GenericTable<Custodia>
          columns={columns}
          data={custodias}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p) => setPage(p),
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

        <CustodiaDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingCustodia(null);
            loadCustodias();
          }}
          onSubmit={handleSubmit}
          custodia={editingCustodia}
          tipo="P"
          initialFuncionarios={funcionarios}
          initialClientes={clientes}
          initialBancos={bancos}
        />

        <DeleteConfirmationDialog
          open={confirmState.isOpen}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          title={confirmState.isBulk ? 'Excluir passivos selecionados?' : 'Excluir passivo?'}
          itemName={confirmState.itemName}
          isBulk={confirmState.isBulk}
          itemCount={confirmState.itemIds.length}
        />
      </main>
    </div>
  );
}
