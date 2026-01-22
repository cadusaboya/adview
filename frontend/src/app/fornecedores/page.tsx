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

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { FileText, DollarSign, Pencil, Trash } from 'lucide-react';

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
  const pageSize = 10;

  // ======================
  // 🔄 LOAD
  // ======================
  const loadFornecedores = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getFornecedores({ page, page_size: pageSize });
      setFornecedores(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
      message.error('Erro ao buscar fornecedores');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadFornecedores();
  }, [loadFornecedores]);

  // ======================
  // ❌ DELETE
  // ======================
  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente excluir este fornecedor?')) return;

    try {
      await deleteFornecedor(id);
      toast.success('Fornecedor excluído com sucesso!');
      loadFornecedores();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir fornecedor');
    }
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
    { title: 'Nome', dataIndex: 'nome' },
    { title: 'CPF / CNPJ', dataIndex: 'cpf' },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Ações',
      key: 'actions',
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

      <main className="bg-[#FAFCFF] min-h-screen w-full p-6">
        <div className="flex justify-between mb-4">
          <h1 className="text-xl font-semibold">Fornecedores</h1>

          <Button
            className="shadow-md"
            onClick={() => {
              setEditingFornecedor(null);
              setOpenDialog(true);
            }}
          >
            Criar Fornecedor
          </Button>
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
          }}
        />

        {/* 🔹 DIALOG CRIAR / EDITAR */}
        <FuncionarioDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingFornecedor(null);
          }}
          onSubmit={handleSubmit}
          funcionario={editingFornecedor}
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
      </main>
    </div>
  );
}
