'use client';

import { useEffect, useState, useCallback } from 'react';

import {
  getClientes,
  deleteCliente,
  createCliente,
  updateCliente,
} from '@/services/clientes';

import {
  Cliente,
  ClienteCreate,
  ClienteUpdate,
} from '@/types/clientes';

import { Button } from 'antd';
import type { TableColumnsType } from 'antd';
import GenericTable from '@/components/imports/GenericTable';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import ClienteDialog from '@/components/dialogs/ClienteDialog';
import { ClienteProfileDialog } from '@/components/dialogs/ClienteProfileDialog';
import { gerarRelatorioPDF } from '@/services/pdf';
import { useUpgradeGuard } from '@/hooks/useUpgradeGuard';
import { UpgradeDialog } from '@/components/UpgradeDialog';
import { toast } from 'sonner';
import { formatCpfCnpj } from '@/lib/formatters';
import { getErrorMessage } from '@/lib/errors';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import RelatorioFiltrosModal, {
  RelatorioFiltros,
} from '@/components/dialogs/RelatorioFiltrosModal';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import {
  Pencil,
  Trash,
  FileText,
  DollarSign,
} from 'lucide-react';

export default function ClientePage() {
  const { guard, isUpgradeDialogOpen, closeUpgradeDialog, blockedFeatureLabel } = useUpgradeGuard();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  const [loadingRelatorio, setLoadingRelatorio] = useState<number | null>(null);
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);

  // Cliente Profile Dialog state
  const [openProfileDialog, setOpenProfileDialog] = useState(false);
  const [profileClienteId, setProfileClienteId] = useState<number | null>(null);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Search state
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Sort state
  const [ordering, setOrdering] = useState('');

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);


  // ======================
  // 🔄 LOAD
  // ======================
  const loadClientes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getClientes({
        page,
        page_size: pageSize,
        search: debouncedSearch,
        ordering: ordering || undefined,
      });
      setClientes(res.results);
      setTotal(res.count);
    } catch (error: unknown) {
      console.error(error);
      toast.error('Erro ao buscar clientes');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, ordering]);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Clear selection when page or pageSize changes
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [page, pageSize]);

  // ======================
  // ❌ DELETE
  // ======================
  const handleDeleteAction = async (id: number) => {
    try {
      await deleteCliente(id);
      toast.success('Cliente excluído com sucesso');
      loadClientes();
    } catch (error: unknown) {
      console.error(error);
      toast.error('Erro ao excluir cliente');
    }
  };

  const handleBulkDeleteAction = async (ids: number[]) => {
    try {
      setLoading(true);

      // Delete all selected items
      await Promise.all(
        ids.map((id) => deleteCliente(id))
      );

      toast.success(`${ids.length} cliente(s) excluído(s) com sucesso`);
      setSelectedRowKeys([]);
      loadClientes();
    } catch (error: unknown) {
      console.error(error);
      toast.error('Erro ao excluir clientes');
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
    const cliente = clientes.find((c) => c.id === id);
    confirmDelete(id, cliente?.nome);
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Selecione pelo menos um cliente');
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
    data: ClienteCreate | ClienteUpdate
  ) => {
    try {
      if (editingCliente) {
        // UPDATE → parcial
        await updateCliente(
          editingCliente.id,
          data as ClienteUpdate
        );
        toast.success('Cliente atualizado com sucesso!');
      } else {
        // CREATE → payload completo
        await createCliente(data as ClienteCreate);
        toast.success('Cliente criado com sucesso!');
      }

      setOpenDialog(false);
      setEditingCliente(null);
      loadClientes();
    } catch (error: unknown) {
      console.error(error);
      toast.error(getErrorMessage(error, 'Erro ao salvar cliente'));
    }
  };


  // ======================
  // 📊 RELATÓRIO
  // ======================
  const handleOpenRelatorioModal = (clienteId: number) => {
    setSelectedClienteId(clienteId);
    setOpenRelatorioModal(true);
  };

  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    if (!selectedClienteId) return;

    try {
      setLoadingRelatorio(selectedClienteId);

      await gerarRelatorioPDF('cliente-especifico', {
        cliente_id: selectedClienteId,
        ...filtros,
      });

      toast.success('Relatório gerado com sucesso!');
    } catch (error: unknown) {
      console.error(error);

      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Erro ao gerar relatório');
      }
    } finally {
      setLoadingRelatorio(null);
    }
  };

  // ======================
  // 📊 TABELA
  // ======================
  const columns: TableColumnsType<Cliente> = [
    { title: 'Nome', dataIndex: 'nome', width: '45%', sorter: true },
    {
      title: 'CPF / CNPJ',
      dataIndex: 'cpf',
      width: '16%',
      render: (cpf: string) => formatCpfCnpj(cpf),
    },
    { title: 'Email', dataIndex: 'email', width: '20%', sorter: true },
    { title: 'Tipo', dataIndex: 'tipo_display', width: '8%' },
    {
      title: 'Ações',
      key: 'actions',
      width: '6%',
      render: (_: unknown, record: Cliente) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Financeiro',
              icon: DollarSign,
              onClick: () => {
                setProfileClienteId(record.id);
                setOpenProfileDialog(true);
              },
            },
            {
              label: 'Gerar PDF',
              icon: FileText,
              onClick: guard('pdf_export', () =>
                handleOpenRelatorioModal(record.id)
              ),
              disabled:
                loadingRelatorio === record.id,
            },
            { divider: true },
            {
              label: 'Editar',
              icon: Pencil,
              onClick: () => {
                setEditingCliente(record);
                setOpenDialog(true);
              },
            },
            {
              label: 'Excluir',
              icon: Trash,
              danger: true,
              onClick: () =>
                handleDelete(record.id),
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
        <div className="flex justify-between mb-4">
          <h1 className="text-2xl font-serif font-bold text-navy">Clientes</h1>
          <div className="flex gap-3 items-center">
            <Input
              placeholder="Buscar clientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-80"
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
                setEditingCliente(null);
                setOpenDialog(true);
              }}
            >
              Criar Cliente
            </Button>
          </div>
        </div>

        <GenericTable<Cliente>
          columns={columns}
          data={clientes}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (page) => setPage(page),
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onShowSizeChange: (_, size) => {
              setPageSize(size);
              setPage(1);
            },
          }}
          onSortChange={(o) => { setOrdering(o); setPage(1); }}
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={handleSelectionChange}
        />

        <ClienteDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingCliente(null);
            loadClientes(); // Refetch para atualizar mudanças (ex: formas de cobrança)
          }}
          onSubmit={handleSubmit}
          cliente={editingCliente}
        />

        {/* Single Profile Dialog with dynamic clientId */}
        {profileClienteId && (
          <ClienteProfileDialog
            open={openProfileDialog}
            clientId={profileClienteId}
            onClose={() => {
              setOpenProfileDialog(false);
              setProfileClienteId(null);
            }}
          />
        )}

        <RelatorioFiltrosModal
          open={openRelatorioModal}
          onClose={() => {
            setOpenRelatorioModal(false);
            setSelectedClienteId(null);
          }}
          onGenerate={handleGerarRelatorio}
          title="Relatório de Cliente"
          tipoRelatorio="cliente-especifico"
          clientes={clientes}
        />

        <UpgradeDialog
          open={isUpgradeDialogOpen}
          onClose={closeUpgradeDialog}
          feature={blockedFeatureLabel}
        />

        <DeleteConfirmationDialog
          open={confirmState.isOpen}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          title={confirmState.isBulk ? 'Excluir clientes selecionados?' : 'Excluir cliente?'}
          itemName={confirmState.itemName}
          isBulk={confirmState.isBulk}
          itemCount={confirmState.itemIds.length}
        />
      </main>
    </div>
  );
}
