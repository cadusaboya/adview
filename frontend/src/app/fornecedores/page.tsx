'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';

import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import FuncionarioDialog from '@/components/dialogs/FuncionarioDialog';
import { FuncionarioProfileDialog } from '@/components/dialogs/FuncionarioProfileDialog';
import RelatorioFiltrosModal from '@/components/dialogs/RelatorioFiltrosModal';

import {
  getFornecedores,
  createFornecedor,
  updateFornecedor,
  deleteFornecedor,
} from '@/services/fornecedores';

import {
  Fornecedor,
  FornecedorCreate,
  FornecedorUpdate,
} from '@/types/fornecedores';

import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';
import { formatCpfCnpj } from '@/lib/formatters';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { FileText, DollarSign, Pencil, Trash } from 'lucide-react';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';

export default function FornecedorPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingFornecedor, setEditingFornecedor] =
    useState<Fornecedor | null>(null);

  // 📊 Relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [fornecedorParaRelatorio, setFornecedorParaRelatorio] =
    useState<Fornecedor | null>(null);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  // Paginação
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
  const loadFornecedores = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getFornecedores({
        page,
        page_size: pageSize,
        search: debouncedSearch,
        ordering: ordering || undefined,
      });
      setFornecedores(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
      message.error('Erro ao buscar fornecedores');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, ordering]);

  useEffect(() => {
    loadFornecedores();
  }, [loadFornecedores]);

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
      await deleteFornecedor(id);
      toast.success('Fornecedor excluído com sucesso!');
      loadFornecedores();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir fornecedor');
    }
  };

  const handleBulkDeleteAction = async (ids: number[]) => {
    try {
      setLoading(true);

      // Delete all selected items
      await Promise.all(
        ids.map((id) => deleteFornecedor(id))
      );

      toast.success(`${ids.length} fornecedor(es) excluído(s) com sucesso`);
      setSelectedRowKeys([]);
      loadFornecedores();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir fornecedores');
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
    const fornecedor = fornecedores.find((f) => f.id === id);
    confirmDelete(id, fornecedor?.nome);
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Selecione pelo menos um fornecedor');
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
    data: FornecedorCreate | FornecedorUpdate
  ) => {
    try {
      if (editingFornecedor) {
        await updateFornecedor(editingFornecedor.id, data as FornecedorUpdate);
        toast.success('Fornecedor atualizado com sucesso!');
      } else {
        await createFornecedor(data as FornecedorCreate);
        toast.success('Fornecedor criado com sucesso!');
      }

      setOpenDialog(false);
      setEditingFornecedor(null);
      loadFornecedores();
    } catch (error) {
      console.error('Erro ao salvar fornecedor:', error);
      toast.error('Erro ao salvar fornecedor');
    }
  };

  // ======================
  // 📊 RELATÓRIO
  // ======================
  const handleAbrirRelatorioFornecedor = (fornecedor: Fornecedor) => {
    setFornecedorParaRelatorio(fornecedor);
    setOpenRelatorioModal(true);
  };

  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      setLoadingRelatorio(true);

      if (!fornecedorParaRelatorio?.id) {
        toast.error('Fornecedor não selecionado');
        return;
      }

      await gerarRelatorioPDF('funcionario-especifico', {
        funcionario_id: fornecedorParaRelatorio.id,
        ...filtros,
      });

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
  const columns: TableColumnsType<Fornecedor> = [
    { title: 'Nome', dataIndex: 'nome', width: '45%', sorter: true },
    {
      title: 'CPF / CNPJ',
      dataIndex: 'cpf',
      width: '20%',
      render: (cpf: string) => formatCpfCnpj(cpf),
    },
    { title: 'Email', dataIndex: 'email', width: '25%' },
    {
      title: 'Ações',
      key: 'actions',
      width: '6%',
      render: (_: unknown, record: Fornecedor) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Financeiro',
              icon: DollarSign,
              onClick: () => {
                document
                  .getElementById(`forn-fin-${record.id}`)
                  ?.click();
              },
            },
            {
              label: 'Gerar Relatório',
              icon: FileText,
              onClick: () => handleAbrirRelatorioFornecedor(record),
              disabled:
                loadingRelatorio &&
                fornecedorParaRelatorio?.id === record.id,
            },
            { divider: true },
            {
              label: 'Editar',
              icon: Pencil,
              onClick: () => {
                setEditingFornecedor(record);
                setOpenDialog(true);
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
        <div className="flex justify-between mb-4">
          <h1 className="text-2xl font-serif font-bold text-navy">Fornecedores</h1>

          <div className="flex gap-3 items-center">
            <Input
              placeholder="Buscar fornecedores..."
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
                setEditingFornecedor(null);
                setOpenDialog(true);
              }}
            >
              Criar Fornecedor
            </Button>
          </div>
        </div>

        <GenericTable<Fornecedor>
          columns={columns}
          data={fornecedores}
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

        {/* 🔹 DIALOG CRIAR / EDITAR */}
        <FuncionarioDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingFornecedor(null);
            loadFornecedores(); // Refetch para atualizar mudanças
          }}
          onSubmit={handleSubmit}
          funcionario={editingFornecedor}
          mode="fornecedor"
        />

        {/* 🔹 DIALOG FINANCEIRO (hidden triggers) */}
        {fornecedores.map((f) => (
          <FuncionarioProfileDialog key={f.id} funcionarioId={f.id}>
            <button
              id={`forn-fin-${f.id}`}
              className="hidden"
            />
          </FuncionarioProfileDialog>
        ))}

        {/* 📊 MODAL RELATÓRIO */}
        <RelatorioFiltrosModal
          open={openRelatorioModal}
          onClose={() => {
            setOpenRelatorioModal(false);
            setFornecedorParaRelatorio(null);
          }}
          onGenerate={handleGerarRelatorio}
          title={`Relatório de Despesas - ${
            fornecedorParaRelatorio?.nome || 'Fornecedor'
          }`}
          tipoRelatorio="funcionario-especifico"
        />

        <DeleteConfirmationDialog
          open={confirmState.isOpen}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          title={confirmState.isBulk ? 'Excluir fornecedores selecionados?' : 'Excluir fornecedor?'}
          itemName={confirmState.itemName}
          isBulk={confirmState.isBulk}
          itemCount={confirmState.itemIds.length}
        />
      </main>
    </div>
  );
}
