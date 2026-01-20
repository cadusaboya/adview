'use client';

import { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { toast } from 'sonner';
import type { TableColumnsType } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import GenericTable from '@/components/imports/GenericTable';
import ReceitaDialog from '@/components/dialogs/ReceitaDialog';
import RelatorioFiltrosModal from '@/components/dialogs/RelatorioFiltrosModal';
import { Input } from '@/components/ui/input';

import {
  getPayments,
  deletePayment,
  Payment,
} from '@/services/payments';

import { Receita, getReceitaById } from '@/services/receitas';
import { getClientes, Cliente } from '@/services/clientes';
import { gerarRelatorioPDF } from '@/services/pdf';
import { RelatorioFiltros } from '@/components/dialogs/RelatorioFiltrosModal';

export default function ReceitaRecebidasPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);

  // 📊 Estados para o modal de relatório
  const [openRelatorioModal, setOpenRelatorioModal] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 🔎 SEARCH
  const [search, setSearch] = useState('');

  // 🔁 Debounce do search (IGUAL Despesas)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      loadData();
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  // Carregar clientes para o modal de relatório
  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      const res = await getClientes({ page_size: 1000 });
      setClientes(res.results);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const res = await getPayments({
        page,
        page_size: pageSize,
        search: search,
      });

      // 🔹 Apenas pagamentos vinculados a receitas
      const receitaPayments = res.results.filter(
        (p: Payment) => p.receita !== null
      );

      setPayments(receitaPayments);
      setTotal(res.count);
    } catch (error) {
      console.error(error);
      message.error('Erro ao buscar recebimentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

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

  const handleEditReceita = async (receitaId?: number | null) => {
    if (!receitaId) return;

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

  // 📊 Gerar relatório com filtros
  const handleGerarRelatorio = async (filtros: RelatorioFiltros) => {
    try {
      setLoadingRelatorio(true);
      await gerarRelatorioPDF('receitas-pagas', filtros);
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
      title: 'Data de Recebimento',
      dataIndex: 'data_pagamento',
      render: (value) => formatDateBR(value),
    },
    {
      title: 'Cliente',
      dataIndex: 'cliente_nome',
      render: (nome) => nome ?? '—',
    },
    {
      title: 'Descrição',
      dataIndex: 'receita_nome',
      render: (nome) => nome ?? '—',
    },
    {
      title: 'Valor Recebido',
      dataIndex: 'valor',
      render: (v) => formatCurrencyBR(v),
    },
    {
      title: 'Ações',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button onClick={() => handleEditReceita(record.receita)}>
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

        <ReceitaDialog
          open={openDialog}
          onClose={() => {
            setOpenDialog(false);
            setEditingReceita(null);
          }}
          receita={editingReceita}
          onSubmit={() => {
            setOpenDialog(false);
            setEditingReceita(null);
            loadData();
          }}
        />

        {/* 📊 MODAL DE FILTROS DO RELATÓRIO */}
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
