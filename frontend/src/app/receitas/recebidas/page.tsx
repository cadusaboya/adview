'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import RelatorioFiltrosModal from '@/components/dialogs/RelatorioFiltrosModal';
import { Input } from '@/components/ui/input';

import {
  getPayments,
  deletePayment,
} from '@/services/payments';

import { Payment } from '@/types/payments';
import { Cliente } from '@/types/clientes';

import { getClientes } from '@/services/clientes';
import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';

import { ActionsDropdown } from '@/components/imports/ActionsDropdown';
import { Trash, FileText } from 'lucide-react';

export default function ReceitaRecebidasPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  // 📊 Relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  // Paginação
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 🔎 Busca
  const [search, setSearch] = useState('');

  // ======================
  // 🔁 SEARCH DEBOUNCE
  // ======================
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

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
  // 🔄 LOAD PAGAMENTOS
  // ======================
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const res = await getPayments({
        page,
        page_size: pageSize,
        search,
        tipo: 'receita',
      });

      setPayments(res.results);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar recebimentos');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ======================
  // ❌ DELETE RECEBIMENTO
  // ======================
  const handleDeletePayment = async (id: number) => {
    if (!confirm('Deseja realmente excluir este recebimento?')) return;

    try {
      await deletePayment(id);
      toast.success('Recebimento excluído com sucesso!');
      loadData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir recebimento');
    }
  };

  // ======================
  // 📄 GERAR RECIBO
  // ======================
  const handleGerarRecibo = async (paymentId: number) => {
    try {
      await gerarRelatorioPDF('recibo-pagamento', {
        payment_id: paymentId,
      });
      toast.success('Recibo gerado com sucesso!');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro ao gerar recibo';
      console.error(error);
      toast.error(errorMessage);
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
  const columns: TableColumnsType<Payment> = [
    {
      title: 'Data de Recebimento',
      dataIndex: 'data_pagamento',
      width: '15%',
      render: (v: string) => formatDateBR(v),
    },
    {
      title: 'Cliente',
      dataIndex: 'cliente_nome',
      width: '25%',
      render: (v?: string) => v ?? '—',
    },
    {
      title: 'Descrição',
      dataIndex: 'receita_nome',
      width: '30%',
      render: (v?: string) => v ?? '—',
    },
    {
      title: 'Valor Recebido',
      dataIndex: 'valor',
      width: '15%',
      render: (v: number) => formatCurrencyBR(v),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: '6%',
      render: (_: unknown, record: Payment) => (
        <ActionsDropdown
          actions={[
            {
              label: 'Gerar Recibo',
              icon: FileText,
              onClick: () => handleGerarRecibo(record.id),
            },
            {
              label: 'Excluir Recebimento',
              icon: Trash,
              danger: true,
              onClick: () => handleDeletePayment(record.id),
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
        {/* 🔝 HEADER */}
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-xl font-semibold whitespace-nowrap">
            Receitas Recebidas
          </h1>

          <Input
            placeholder="Buscar por cliente, descrição, valor, data..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-md"
          />

          <div className="flex-1" />

          <Button
            icon={<DownloadOutlined />}
            onClick={() => setOpenRelatorioModal(true)}
            loading={loadingRelatorio}
            className="shadow-md whitespace-nowrap"
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
            onChange: (p) => setPage(p),
          }}
        />

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
      </main>
    </div>
  );
}
