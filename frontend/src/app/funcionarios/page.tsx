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
  getFuncionarios,
  createFuncionario,
  updateFuncionario,
  deleteFuncionario,
} from '@/services/funcionarios';

import {
  Funcionario,
  FuncionarioCreate,
  FuncionarioUpdate,
} from '@/types/funcionarios';

import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';
import { formatCurrencyBR, formatCpfCnpj } from '@/lib/formatters';
import { getErrorMessage } from '@/lib/errors';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { FileText, DollarSign, Pencil, Trash } from 'lucide-react';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import { DeleteConfirmationDialog } from '@/components/dialogs/DeleteConfirmationDialog';

export default function FuncionarioPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingFuncionario, setEditingFuncionario] =
    useState<Funcionario | null>(null);

  // 📊 Relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [funcionarioParaRelatorio, setFuncionarioParaRelatorio] = useState<Funcionario | null>(null);

  // Paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Search state
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Row selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // ======================
  // 🔄 LOAD
  // ======================
  const loadFuncionarios = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getFuncionarios({
        page,
        page_size: pageSize,
        search: debouncedSearch
      });
      setFuncionarios(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar funcionários');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    loadFuncionarios();
  }, [loadFuncionarios]);

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
      await deleteFuncionario(id);
      toast.success('Funcionário excluído com sucesso!');
      loadFuncionarios();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir funcionário');
    }
  };

  const handleBulkDeleteAction = async (ids: number[]) => {
    try {
      setLoading(true);

      // Delete all selected items
      await Promise.all(
        ids.map((id) => deleteFuncionario(id))
      );

      toast.success(`${ids.length} funcionário(s) excluído(s) com sucesso`);
      setSelectedRowKeys([]);
      loadFuncionarios();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir funcionários');
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
    const funcionario = funcionarios.find((f) => f.id === id);
    confirmDelete(id, funcionario?.nome);
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Selecione pelo menos um funcionário');
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
    data: FuncionarioCreate | FuncionarioUpdate
  ) => {
    try {
      if (editingFuncionario) {
        await updateFuncionario(editingFuncionario.id, data);
        toast.success('Funcionário atualizado com sucesso!');
      } else {
        await createFuncionario(data as FuncionarioCreate);
        toast.success('Funcionário criado com sucesso!');
      }

      setOpenDialog(false);
      setEditingFuncionario(null);
      loadFuncionarios();
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, 'Erro ao salvar funcionário'));
    }
  };

  // ======================
  // 📊 RELATÓRIO
  // ======================
  const handleAbrirRelatorioFuncionario = (funcionario: Funcionario) => {
    setFuncionarioParaRelatorio(funcionario);
    setOpenRelatorioModal(true);
  };

  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      if (!funcionarioParaRelatorio?.id) {
        toast.error('Funcionário não selecionado');
        return;
      }

      await gerarRelatorioPDF('funcionario-especifico', {
        funcionario_id: funcionarioParaRelatorio.id,
        ...filtros,
      });

      toast.success('Relatório gerado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar relatório');
    }
  };

  // ======================
  // 📊 TABELA
  // ======================
  const columns: TableColumnsType<Funcionario> = [
    { title: 'Nome', dataIndex: 'nome', width: '39%' },
    {
      title: 'CPF',
      dataIndex: 'cpf',
      width: '15%',
      render: (cpf: string) => formatCpfCnpj(cpf),
    },
    { title: 'Email', dataIndex: 'email', width: '20%' },
    {
      title: 'Salário Mensal',
      dataIndex: 'salario_mensal',
      width: '15%',
      render: (v: number | null) =>
        v ? formatCurrencyBR(v) : '—',
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '6%',
      render: (_: unknown, record: Funcionario) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Financeiro',
              icon: DollarSign,
              onClick: () => {
                document
                  .getElementById(`func-fin-${record.id}`)
                  ?.click();
              },
            },
            {
              label: 'Gerar Relatório',
              icon: FileText,
              onClick: () =>
                handleAbrirRelatorioFuncionario(record),
            },
            { divider: true },
            {
              label: 'Editar',
              icon: Pencil,
              onClick: () => {
                setEditingFuncionario(record);
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
          <h1 className="text-2xl font-serif font-bold text-navy">Funcionários</h1>

          <div className="flex gap-3 items-center">
            <Input
              placeholder="Buscar funcionários..."
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
                setEditingFuncionario(null);
                setOpenDialog(true);
              }}
            >
              Criar Funcionário
            </Button>
          </div>
        </div>

        <GenericTable<Funcionario>
          columns={columns}
          data={funcionarios}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: setPage,
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

        <FuncionarioDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingFuncionario(null);
            loadFuncionarios(); // Refetch para atualizar mudanças
          }}
          onSubmit={handleSubmit}
          funcionario={editingFuncionario}
        />

        {funcionarios.map((f) => (
          <FuncionarioProfileDialog
            key={f.id}
            funcionarioId={f.id}
          >
            <button
              id={`func-fin-${f.id}`}
              className="hidden"
            />
          </FuncionarioProfileDialog>
        ))}

        <RelatorioFiltrosModal
          open={openRelatorioModal}
          onClose={() => {
            setOpenRelatorioModal(false);
            setFuncionarioParaRelatorio(null);
          }}
          onGenerate={handleGerarRelatorio}
          title={`Relatório de Despesas - ${
            funcionarioParaRelatorio?.nome || 'Funcionário'
          }`}
          tipoRelatorio="funcionario-especifico"
        />

        <DeleteConfirmationDialog
          open={confirmState.isOpen}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          title={confirmState.isBulk ? 'Excluir funcionários selecionados?' : 'Excluir funcionário?'}
          itemName={confirmState.itemName}
          isBulk={confirmState.isBulk}
          itemCount={confirmState.itemIds.length}
        />
      </main>
    </div>
  );
}
