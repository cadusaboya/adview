"use client";

import { useEffect, useState } from "react";
import { Button, message } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { NavbarNested } from "@/components/imports/Navbar/NavbarNested";
import GenericTable from "@/components/imports/GenericTable";
import type { TableColumnsType } from "antd";
import FuncionarioDialog from "@/components/dialogs/FuncionarioDialog";
import { FuncionarioProfileDialog } from "@/components/dialogs/FuncionarioProfileDialog";
import RelatorioFiltrosModal from "@/components/dialogs/RelatorioFiltrosModal";
import { gerarRelatorioPDF } from "@/services/pdf";
import { RelatorioFiltros } from "@/components/dialogs/RelatorioFiltrosModal";
import { formatCurrencyBR } from "@/lib/formatters";

import {
  getFuncionarios,
  createFuncionario,
  updateFuncionario,
  deleteFuncionario,
  Funcionario,
} from "@/services/funcionarios";

export default function FuncionarioPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingFuncionario, setEditingFuncionario] =
    useState<Funcionario | null>(null);

  // 📊 Estados para o modal de relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [funcionarioParaRelatorio, setFuncionarioParaRelatorio] = useState<Funcionario | null>(null);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  // 🔥 Paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadFuncionarios = async () => {
    try {
      setLoading(true);
      const res = await getFuncionarios({ page, page_size: pageSize });
      setFuncionarios(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error("Erro ao buscar funcionários:", error);
      message.error("Erro ao buscar funcionários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFuncionarios();
  }, [page]);

  const handleDelete = async (id: number) => {
    if (confirm("Deseja realmente excluir este funcionário?")) {
      await deleteFuncionario(id);
      toast.success("Funcionário excluído com sucesso!");
      loadFuncionarios();
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingFuncionario) {
        await updateFuncionario(editingFuncionario.id, data);
        toast.success("Funcionário atualizado com sucesso!");
      } else {
        await createFuncionario(data);
        toast.success("Funcionário criado com sucesso!");
      }
      setOpenDialog(false);
      setEditingFuncionario(null);
      loadFuncionarios();
    } catch (error) {
      console.error("Erro ao salvar funcionário:", error);
      toast.error("Erro ao salvar funcionário");
    }
  };

  // 📊 Gerar relatório de despesas do funcionário
  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      setLoadingRelatorio(true);
      // Para relatório de funcionário, o funcionario_id é obrigatório
      if (!funcionarioParaRelatorio?.id) {
        toast.error("Funcionário não selecionado");
        return;
      }

      // Gerar relatório de funcionário específico (despesas a pagar e pagas)
      await gerarRelatorioPDF("funcionario-especifico", {
        funcionario_id: funcionarioParaRelatorio.id,
        ...filtros,
      });
      toast.success("Relatório gerado com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao gerar relatório");
    } finally {
      setLoadingRelatorio(false);
    }
  };

  // 📊 Abrir modal de relatório para um funcionário específico
  const handleAbrirRelatorioFuncionario = (funcionario: Funcionario) => {
    setFuncionarioParaRelatorio(funcionario);
    setOpenRelatorioModal(true);
  };

  const columns: TableColumnsType<Funcionario> = [
    { title: "Nome", dataIndex: "nome" },
    { title: "CPF", dataIndex: "cpf" },
    { title: "Email", dataIndex: "email" },
    {
      title: "Salário Mensal",
      dataIndex: "salario_mensal",
      render: (v) => formatCurrencyBR(v),
    },
    {
      title: "Ações",
      render: (_: any, record: Funcionario) => (
        <div className="flex gap-2">
          {/* 🔹 RELATÓRIO */}
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => handleAbrirRelatorioFuncionario(record)}
            loading={loadingRelatorio && funcionarioParaRelatorio?.id === record.id}
            size="small"
          >
            Relatório
          </Button>

          {/* 🔹 FINANCEIRO */}
          <FuncionarioProfileDialog funcionarioId={record.id}>
            <Button type="default">Financeiro</Button>
          </FuncionarioProfileDialog>

          {/* 🔹 EDITAR */}
          <Button
            onClick={() => {
              setEditingFuncionario(record);
              setOpenDialog(true);
            }}
          >
            Editar
          </Button>

          {/* 🔹 EXCLUIR */}
          <Button danger onClick={() => handleDelete(record.id)}>
            Excluir
          </Button>
        </div>
      ),
    },
  ];

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

        {/* 📊 MODAL DE RELATÓRIO DE DESPESAS DO FUNCIONÁRIO */}
        <RelatorioFiltrosModal
          open={openRelatorioModal}
          onClose={() => {
            setOpenRelatorioModal(false);
            setFuncionarioParaRelatorio(null);
          }}
          onGenerate={handleGerarRelatorio}
          title={`Relatório de Despesas - ${funcionarioParaRelatorio?.nome || "Funcionário"}`}
          tipoRelatorio="funcionario-especifico"
        />
      </main>
    </div>
  );
}
