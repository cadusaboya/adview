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
import { toast } from 'sonner';
import { formatCpfCnpj } from '@/lib/formatters';
import { getErrorMessage } from '@/lib/errors';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import RelatorioFiltrosModal, {
  RelatorioFiltros,
} from '@/components/dialogs/RelatorioFiltrosModal';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import {
  Pencil,
  Trash,
  FileText,
  DollarSign,
} from 'lucide-react';

export default function ClientePage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  const [loadingRelatorio, setLoadingRelatorio] = useState<number | null>(null);
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Search state
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

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
        search: debouncedSearch
      });
      setClientes(res.results);
      setTotal(res.count);
    } catch (error: unknown) {
      console.error(error);
      toast.error('Erro ao buscar clientes');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // ======================
  // ❌ DELETE
  // ======================
  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente excluir este cliente?')) return;

    try {
      await deleteCliente(id);
      toast.success('Cliente excluído com sucesso');
      loadClientes();
    } catch (error: unknown) {
      console.error(error);
      toast.error('Erro ao excluir cliente');
    }
  };

  // ======================
  // ❌ BULK DELETE
  // ======================
  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Selecione pelo menos um cliente');
      return;
    }

    if (!confirm(`Deseja realmente excluir ${selectedRowKeys.length} cliente(s)?`)) return;

    try {
      setLoading(true);

      // Delete all selected items
      await Promise.all(
        selectedRowKeys.map((id) => deleteCliente(Number(id)))
      );

      toast.success(`${selectedRowKeys.length} cliente(s) excluído(s) com sucesso`);
      setSelectedRowKeys([]);
      loadClientes();
    } catch (error: unknown) {
      console.error(error);
      toast.error('Erro ao excluir clientes');
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
    { title: 'Nome', dataIndex: 'nome', width: '45%' },
    {
      title: 'CPF / CNPJ',
      dataIndex: 'cpf',
      width: '16%',
      render: (cpf: string) => formatCpfCnpj(cpf),
    },
    { title: 'Email', dataIndex: 'email', width: '20%' },
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
                document
                  .getElementById(`cliente-fin-${record.id}`)
                  ?.click();
              },
            },
            {
              label: 'Gerar PDF',
              icon: FileText,
              onClick: () =>
                handleOpenRelatorioModal(record.id),
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

      <main className="bg-muted min-h-screen w-full p-6">
        <div className="flex justify-between mb-4">
          <h1 className="text-2xl font-serif font-bold text-navy">Clientes</h1>
          <div className="flex gap-3 items-center">
            <Input
              placeholder="Buscar clientes..."
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
          }}
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

        {clientes.map((cliente) => (
          <ClienteProfileDialog
            key={cliente.id}
            clientId={cliente.id}
          >
            <button
              id={`cliente-fin-${cliente.id}`}
              className="hidden"
            />
          </ClienteProfileDialog>
        ))}

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
      </main>
    </div>
  );
}
