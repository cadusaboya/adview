'use client';

import { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import DespesaDialog from '@/components/dialogs/DespesaDialog';
import RelatorioFiltrosModal from '@/components/dialogs/RelatorioFiltrosModal';
import { Input } from '@/components/ui/input';

import {
  getPayments,
  deletePayment,
  Payment,
} from '@/services/payments';

import { Despesa, getDespesaById } from '@/services/despesas';
import { getFavorecidos, Favorecido } from '@/services/favorecidos';
import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';

export default function DespesasPagasPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);

  // 📊 Estados para o modal de relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Favorecido[]>([]);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 🔎 SEARCH
  const [search, setSearch] = useState('');

  // 🔁 Debounce do search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      loadData();
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  // Carregar funcionários para o modal de relatório
  useEffect(() => {
    loadFuncionarios();
  }, []);

  const loadFuncionarios = async () => {
    try {
      const res = await getFavorecidos({ page_size: 1000 });
      setFuncionarios(res.results);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const res = await getPayments({
        page,
        page_size: pageSize,
        search,
      });

      // 🔹 Apenas pagamentos vinculados a despesas
      const despesaPayments = res.results.filter(
        (p: Payment) => p.despesa !== null
      );

      setPayments(despesaPayments);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

  const handleDeletePayment = async (id: number) => {
    if (!confirm('Deseja realmente excluir este pagamento?')) return;

    try {
      await deletePayment(id);
      toast.success('Pagamento excluído com sucesso!');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir pagamento');
    }
  };

  // ✅ Busca a despesa completa antes de abrir o dialog
  const handleEditDespesa = async (despesaId?: number | null) => {
    if (!despesaId) return;

    try {
      setLoading(true);

      const despesa = await getDespesaById(despesaId);
      setEditingDespesa(despesa);
      setOpenDialog(true);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar despesa');
    } finally {
      setLoading(false);
    }
  };

  // 📊 Gerar relatório com filtros
  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      setLoadingRelatorio(true);
      await gerarRelatorioPDF('despesas-pagas', filtros);
      toast.success('Relatório gerado com sucesso!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao gerar relatório');
    } finally {
      setLoadingRelatorio(false);
    }
  };

  const columns: TableColumnsType<Payment> = [
    {
      title: 'Data de Pagamento',
      dataIndex: 'data_pagamento',
      render: (value) => formatDateBR(value),
    },
    {
      title: 'Favorecido',
      dataIndex: 'favorecido_nome',
      render: (nome) => nome ?? '—',
    },
    {
      title: 'Nome',
      dataIndex: 'despesa_nome',
      render: (nome) => nome ?? '—',
    },
    {
      title: 'Valor Pago',
      dataIndex: 'valor',
      render: (v) => formatCurrencyBR(v),
    },
    {
      title: 'Ações',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button onClick={() => handleEditDespesa(record.despesa)}>
            Editar
          </Button>
          <Button danger onClick={() => handleDeletePayment(record.id)}>
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
        {/* 🔝 HEADER */}
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-xl font-semibold whitespace-nowrap">
            Despesas Pagas
          </h1>

          <Input
            placeholder="Buscar por favorecido, nome, valor, data..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-md"
          />

          <div className="flex-1" />

          {/* 📊 BOTÃO PARA GERAR RELATÓRIO */}
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => setOpenRelatorioModal(true)}
            loading={loadingRelatorio}
          >
            Gerar Relatório PDF
          </Button>
        </div>

        <GenericTable<Payment>
          columns={columns}
          data={payments}
          loading={loading}
          pagination={{
            total,
            current: page,
            pageSize,
            onChange: (page) => setPage(page),
          }}
        />

        <DespesaDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingDespesa(null);
          }}
          despesa={editingDespesa}
          onSubmit={() => {
            setOpenDialog(false);
            setEditingDespesa(null);
            loadData();
          }}
        />

        {/* 📊 MODAL DE FILTROS DO RELATÓRIO */}
        <RelatorioFiltrosModal
          open={openRelatorioModal}
          onClose={() => setOpenRelatorioModal(false)}
          onGenerate={handleGerarRelatorio}
          title="Relatório de Despesas Pagas"
          tipoRelatorio="despesas-pagas"
          favorecidos={funcionarios.map((f) => ({
            id: f.id,
            nome: f.nome,
          }))}
        />
      </main>
    </div>
  );
}
