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

import {
  getFornecedores,
  createFornecedor,
  updateFornecedor,
  deleteFornecedor,
  Fornecedor,
} from "@/services/fornecedores";

export default function FornecedorPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingFornecedor, setEditingFornecedor] =
    useState<Fornecedor | null>(null);

  // 📊 Estados para o modal de relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [fornecedorParaRelatorio, setFornecedorParaRelatorio] = useState<Fornecedor | null>(null);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  // 🔹 Paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadFornecedores = async () => {
    try {
      setLoading(true);
      const res = await getFornecedores({ page, page_size: pageSize });
      setFornecedores(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error("Erro ao buscar fornecedores:", error);
      message.error("Erro ao buscar fornecedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFornecedores();
  }, [page]);

  const handleDelete = async (id: number) => {
    if (confirm("Deseja realmente excluir este fornecedor?")) {
      await deleteFornecedor(id);
      toast.success("Fornecedor excluído com sucesso!");
      loadFornecedores();
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      if (editingFornecedor) {
        await updateFornecedor(editingFornecedor.id, data);
        toast.success("Fornecedor atualizado com sucesso!");
      } else {
        await createFornecedor(data);
        toast.success("Fornecedor criado com sucesso!");
      }

      setOpenDialog(false);
      setEditingFornecedor(null);
      loadFornecedores();
    } catch (error) {
      console.error("Erro ao salvar fornecedor:", error);
      toast.error("Erro ao salvar fornecedor");
    }
  };

  // 📊 Gerar relatório de despesas do fornecedor
  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      setLoadingRelatorio(true);
      // Para relatório de funcionário, o funcionario_id é obrigatório
      if (!fornecedorParaRelatorio?.id) {
        toast.error("Fornecedor não selecionado");
        return;
      }

      // Gerar relatório de funcionário específico (despesas a pagar e pagas)
      await gerarRelatorioPDF("funcionario-especifico", {
        funcionario_id: fornecedorParaRelatorio.id,
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

  // 📊 Abrir modal de relatório para um fornecedor específico
  const handleAbrirRelatorioFornecedor = (fornecedor: Fornecedor) => {
    setFornecedorParaRelatorio(fornecedor);
    setOpenRelatorioModal(true);
  };

  const columns: TableColumnsType<Fornecedor> = [
    { title: "Nome", dataIndex: "nome" },
    { title: "CPF / CNPJ", dataIndex: "cpf" },
    { title: "Email", dataIndex: "email" },
    {
      title: "Ações",
      render: (_: any, record: Fornecedor) => (
        <div className="flex gap-2">
          {/* 🔹 RELATÓRIO */}
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => handleAbrirRelatorioFornecedor(record)}
            loading={loadingRelatorio && fornecedorParaRelatorio?.id === record.id}
            size="small"
          >
            Relatório
          </Button>

          {/* 🔹 FINANCEIRO (REUSO TOTAL) */}
          <FuncionarioProfileDialog funcionarioId={record.id}>
            <Button type="default">Financeiro</Button>
          </FuncionarioProfileDialog>

          {/* 🔹 EDITAR */}
          <Button
            onClick={() => {
              setEditingFornecedor(record);
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

        {/* 📊 MODAL DE RELATÓRIO DE DESPESAS DO FORNECEDOR */}
        <RelatorioFiltrosModal
          open={openRelatorioModal}
          onClose={() => {
            setOpenRelatorioModal(false);
            setFornecedorParaRelatorio(null);
          }}
          onGenerate={handleGerarRelatorio}
          title={`Relatório de Despesas - ${fornecedorParaRelatorio?.nome || "Fornecedor"}`}
          tipoRelatorio="funcionario-especifico"
        />
      </main>
    </div>
  );
}
