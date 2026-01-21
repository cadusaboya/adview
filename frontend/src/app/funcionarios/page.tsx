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
  Funcionario,
} from '@/services/funcionarios';

import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';
import { formatCurrencyBR } from '@/lib/formatters';

// ✅ ActionsDropdown
import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import {
  FileText,
  DollarSign,
  Pencil,
  Trash,
} from 'lucide-react';

export default function FuncionarioPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingFuncionario, setEditingFuncionario] =
    useState<Funcionario | null>(null);

  // 📊 Relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [funcionarioParaRelatorio, setFuncionarioParaRelatorio] =
    useState<Funcionario | null>(null);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  // Paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ======================
  // 🔄 LOAD
  // ======================
  const loadFuncionarios = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getFuncionarios({ page, page_size: pageSize });
      setFuncionarios(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error('Erro ao buscar funcionários:', error);
      message.error('Erro ao buscar funcionários');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadFuncionarios();
  }, [loadFuncionarios]);

  // ======================
  // ❌ DELETE
  // ======================
  const handleDelete = async (id: number) => {
    if (!confirm('Deseja realmente excluir este funcionário?')) return;

    try {
      await deleteFuncionario(id);
      toast.success('Funcionário excluído com sucesso!');
      loadFuncionarios();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir funcionário');
    }
  };

  // ======================
  // 💾 CREATE / UPDATE
  // ======================
  const handleSubmit = async (data: Funcionario) => {
    try {
      if (editingFuncionario) {
        await updateFuncionario(editingFuncionario.id, data);
        toast.success('Funcionário atualizado com sucesso!');
      } else {
        await createFuncionario(data);
        toast.success('Funcionário criado com sucesso!');
      }

      setOpenDialog(false);
      setEditingFuncionario(null);
      loadFuncionarios();
    } catch (error) {
      console.error('Erro ao salvar funcionário:', error);
      toast.error('Erro ao salvar funcionário');
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
      setLoadingRelatorio(true);

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
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar relatório';
      console.error(error);
      toast.error(errorMessage);
    } finally {
      setLoadingRelatorio(false);
    }
  };

  // ======================
  // 📊 TABELA
  // ======================
  const columns: TableColumnsType<Funcionario> = [
    { title: 'Nome', dataIndex: 'nome' },
    { title: 'CPF', dataIndex: 'cpf' },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Salário Mensal',
      dataIndex: 'salario_mensal',
      render: (v: number) => formatCurrencyBR(v),
    },
    {
      title: 'Ações',
      key: 'actions',
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
              onClick: () => handleAbrirRelatorioFuncionario(record),
              disabled:
                loadingRelatorio &&
                funcionarioParaRelatorio?.id === record.id,
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

      <main className="bg-[#FAFCFF] min-h-screen w-full p-6">
        <div className="flex justify-between mb-4">
          <h1 className="text-xl font-semibold">Funcionários</h1>

          <Button
            className="shadow-md"
            onClick={() => {
              setEditingFuncionario(null);
              setOpenDialog(true);
            }}
          >
            Criar Funcionário
          </Button>
        </div>

        <GenericTable<Funcionario>
          columns={columns}
          data={funcionarios}
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
            setEditingFuncionario(null);
          }}
          onSubmit={handleSubmit}
          funcionario={editingFuncionario}
        />

        {/* 🔹 DIALOG FINANCEIRO (hidden triggers) */}
        {funcionarios.map((f) => (
          <FuncionarioProfileDialog key={f.id} funcionarioId={f.id}>
            <button
              id={`func-fin-${f.id}`}
              className="hidden"
            />
          </FuncionarioProfileDialog>
        ))}

        {/* 📊 MODAL RELATÓRIO */}
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
      </main>
    </div>
  );
}
