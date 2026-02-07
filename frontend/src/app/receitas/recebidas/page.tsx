'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import { useDebounce } from '@/hooks/useDebounce';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import ReceitaDialog from '@/components/dialogs/ReceitaDialog';
import RelatorioFiltrosModal from '@/components/dialogs/RelatorioFiltrosModal';
import { Input } from '@/components/ui/input';

import { Cliente } from '@/types/clientes';
import { Receita, ReceitaUpdate } from '@/types/receitas';
import { getReceitaById, updateReceita, getReceitas, deleteReceita } from '@/services/receitas';

import { getClientes } from '@/services/clientes';
import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Pencil, Trash } from 'lucide-react';

export default function ReceitaRecebidasPage() {
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);

  // 📊 Relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  // Paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 🔎 Busca
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Clear selection when page or pageSize changes
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [page, pageSize]);

  // ======================
  // 👥 CLIENTES (RELATÓRIO)
  // ======================
  const loadClientes = useCallback(async () => {
    try {
      const res = await getClientes({ page_size: 1000 });
      setClientes(res.results);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  }, []);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  // ======================
  // 🔄 LOAD RECEITAS PAGAS
  // ======================
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const res = await getReceitas({
        page,
        page_size: pageSize,
        search: debouncedSearch,
        situacao: 'P', // Apenas receitas pagas
      });

      setReceitas(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar receitas pagas');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ======================
  // ❌ DELETE RECEITA
  // ======================
  const handleDeleteReceitaAction = async (id: number) => {
    try {
      await deleteReceita(id);
      toast.success('Receita excluída com sucesso!');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir receita');
    }
  };

  const handleBulkDeleteAction = async (ids: number[]) => {
    try {
      setLoading(true);

      // Delete all selected items
      await Promise.all(
        ids.map((id) => deleteReceita(id))
      );

      toast.success(`${ids.length} receita(s) excluída(s) com sucesso`);
      setSelectedRowKeys([]);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir receitas');
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
    onDelete: handleDeleteReceitaAction,
    onBulkDelete: handleBulkDeleteAction,
  });

  const handleDeleteReceita = (id: number) => {
    const receita = receitas.find((r) => r.id === id);
    confirmDelete(id, receita?.nome);
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Selecione pelo menos uma receita');
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
  // ✏️ EDITAR RECEITA
  // ======================
  const handleEditReceita = async (receitaId: number) => {
    try {
      setLoading(true);
      const receita = await getReceitaById(receitaId);
      setEditingReceita(receita);
      setOpenDialog(true);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar receita');
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // 💾 UPDATE RECEITA
  // ======================
  const handleUpdateReceita = async (payload: ReceitaUpdate) => {
    if (!editingReceita) return;

    try {
      await updateReceita(editingReceita.id, payload);
      toast.success('Receita atualizada com sucesso!');
      setOpenDialog(false);
      setEditingReceita(null);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar receita');
    }
  };

  // ======================
  // 📊 RELATÓRIO
  // ======================
  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      setLoadingRelatorio(true);
      await gerarRelatorioPDF('receitas-pagas', filtros);
      toast.success('Relatório gerado com sucesso!');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro ao gerar relatório';
      console.error(error);
      toast.error(errorMessage);
    } finally {
      setLoadingRelatorio(false);
    }
  };

  // ======================
  // 📊 TABELA
  // ======================
  const columns: TableColumnsType<Receita> = [
    {
      title: 'Data de Vencimento',
      dataIndex: 'data_vencimento',
      width: '15%',
      render: (v: string) => formatDateBR(v),
    },
    {
      title: 'Cliente',
      dataIndex: ['cliente', 'nome'],
      width: '25%',
      render: (v?: string) => v ?? '—',
    },
    {
      title: 'Descrição',
      dataIndex: 'nome',
      width: '30%',
      render: (v?: string) => v ?? '—',
    },
    {
      title: 'Valor',
      dataIndex: 'valor',
      width: '15%',
      render: (v: number) => formatCurrencyBR(v),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '6%',
      render: (_: unknown, record: Receita) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Editar Receita',
              icon: Pencil,
              onClick: () => handleEditReceita(record.id),
            },
            {
              label: 'Excluir Receita',
              icon: Trash,
              danger: true,
              onClick: () => handleDeleteReceita(record.id),
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
        {/* 🔝 HEADER */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-serif font-bold text-navy">
            Receitas Recebidas
          </h1>

          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Buscar por cliente, descrição, valor, data..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
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
              icon={<DownloadOutlined />}
              onClick={() => setOpenRelatorioModal(true)}
              loading={loadingRelatorio}
              className="shadow-md whitespace-nowrap bg-gold text-navy hover:bg-gold/90"
            >
              Gerar Relatório PDF
            </Button>
          </div>
        </div>

        <GenericTable<Receita>
          columns={columns}
          data={receitas}
          loading={loading}
          pagination={{
            total,
            current: page,
            pageSize,
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

        {/* DIALOG RECEITA */}
        {openDialog && (
          <ReceitaDialog
            open={openDialog}
            receita={editingReceita}
            onClose={() => {
              setOpenDialog(false);
              setEditingReceita(null);
            }}
            onSubmit={handleUpdateReceita}
          />
        )}

        {/* 📊 MODAL RELATÓRIO */}
        <RelatorioFiltrosModal
          open={openRelatorioModal}
          onClose={() => setOpenRelatorioModal(false)}
          onGenerate={handleGerarRelatorio}
          title="Relatório de Receitas Pagas"
          tipoRelatorio="receitas-pagas"
          clientes={clientes.map((c) => ({
            id: c.id,
            nome: c.nome,
          }))}
        />

        <DeleteConfirmationDialog
          open={confirmState.isOpen}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          title={confirmState.isBulk ? 'Excluir receitas selecionadas?' : 'Excluir receita?'}
          itemName={confirmState.itemName}
          isBulk={confirmState.isBulk}
          itemCount={confirmState.itemIds.length}
        />
      </main>
    </div>
  );
}
